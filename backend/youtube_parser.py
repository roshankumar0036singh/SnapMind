import re
import os
import time
import requests
import json
from typing import Tuple

# Global DNS Cache to avoid redundant DoH lookups
DNS_CACHE = {}

def extract_video_id(url: str) -> str:
    """Extract YouTube video ID from standard or short URLs."""
    match = re.search(r'(?:v=|\/)([0-9A-Za-z_-]{11}).*', url)
    return match.group(1) if match else None

def vtt_time_to_seconds(time_str: str) -> float:
    """Convert VTT timestamp (00:00:04.532) to seconds."""
    parts = time_str.replace(',', '.').split(':')
    sec = 0.0
    for i, part in enumerate(reversed(parts)):
        sec += float(part) * (60 ** i)
    return sec

def get_youtube_transcript(url: str) -> Tuple[bool, str, str, str | None]:
    """Wrapper to handle network issues robustly, including DNS failures on certain environments."""
    import socket
    import sys
    
    old_getaddrinfo = socket.getaddrinfo
    is_windows = sys.platform == "win32"
    
    def robust_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        # 0. Check Cache First
        cache_key = (host, port, family)
        if cache_key in DNS_CACHE:
            return DNS_CACHE[cache_key]

        # 1. Prevent recursion and handle known IPs directly
        if host in ["1.1.1.1", "8.8.8.8", "dns.google", "cloudflare-dns.com"]:
            return old_getaddrinfo(host, port, family, type, proto, flags)

        # 2. On Windows, we often need to force AF_INET to avoid [Errno -5]
        effective_family = family
        if is_windows and (family == socket.AF_UNSPEC or family == 0):
            effective_family = socket.AF_INET
        
        try:
            res = old_getaddrinfo(host, port, effective_family, type, proto, flags)
            DNS_CACHE[cache_key] = res
            return res
        except socket.gaierror as e:
            # Fallback level 1: If it fails with AF_INET, try AF_UNSPEC
            if effective_family == socket.AF_INET:
                try:
                    res = old_getaddrinfo(host, port, socket.AF_UNSPEC, type, proto, flags)
                    DNS_CACHE[cache_key] = res
                    return res
                except: pass
            
            # Fallback level 2: Common DNS issue for www.youtube.com vs youtube.com
            if "youtube.com" in host:
                alt_host = "youtube.com" if host.startswith("www.") else f"www.{host}"
                try:
                    res = old_getaddrinfo(alt_host, port, effective_family, type, proto, flags)
                    DNS_CACHE[cache_key] = res
                    return res
                except: pass

            # Fallback level 3: DNS-over-HTTPS (DoH) using Cloudflare
            if "youtube.com" in host or "youtu.be" in host:
                try:
                    print(f"[YOUTUBE_PARSER] [DNS_FALLBACK] Attempting DoH for {host} via 1.1.1.1")
                    doh_url = "https://1.1.1.1/dns-query"
                    doh_params = {"name": host, "type": "A"}
                    doh_headers = {"accept": "application/dns-json"}
                    
                    response = requests.get(doh_url, params=doh_params, headers=doh_headers, timeout=3)
                    if response.status_code == 200:
                        data = response.json()
                        ips = [ans["data"] for ans in data.get("Answer", []) if ans.get("type") == 1]
                        if ips:
                            print(f"[YOUTUBE_PARSER] [DNS_FALLBACK] DoH Success: Resolved {host} to {ips[0]}")
                            results = []
                            for ip in ips:
                                results.append((socket.AF_INET, socket.SOCK_STREAM, 6, '', (ip, port)))
                            DNS_CACHE[cache_key] = results
                            return results
                except Exception as doh_err:
                    print(f"[YOUTUBE_PARSER] [DNS_FALLBACK] DoH failed: {doh_err}")
            
            raise e

    socket.getaddrinfo = robust_getaddrinfo
    try:
        return _get_youtube_transcript_internal(url)
    finally:
        socket.getaddrinfo = old_getaddrinfo

def _get_youtube_transcript_internal(url: str) -> Tuple[bool, str, str, str | None]:
    """
    Fetches the transcript for a YouTube video using a robust hybrid approach:
    1. Primary: youtube-transcript-api (Fast, official-ish API)
    2. Secondary: yt-dlp (Strongest downloader/parser)
    3. Fallback: pytubefix (Aggressive backup)
    Returns: (is_success, text_content, error_message)
    """
    video_id = extract_video_id(url)
    if not video_id:
        return False, "", "Invalid YouTube URL format.", None

    max_retries = 2
    errors = []

    # --- ATTEMPT 1: youtube-transcript-api ---
    try:
        import youtube_transcript_api
        # Direct class access to avoid potential import/shadowing issues causing AttributeError
        YTTA = getattr(youtube_transcript_api, 'YouTubeTranscriptApi', None)
        
        if YTTA:
            print(f"[YOUTUBE_PARSER] Attempting youtube-transcript-api for: {video_id}")
            
            # Robust Check for list_transcripts
            transcript_list = None
            if hasattr(YTTA, 'list_transcripts'):
                try:
                    transcript_list = YTTA.list_transcripts(video_id)
                except Exception as e:
                    print(f"[YOUTUBE_PARSER] list_transcripts call failed: {e}")
            
            transcript = None
            if transcript_list:
                try:
                    transcript = transcript_list.find_transcript(['en', 'en-US', 'en-GB'])
                except:
                    try:
                        transcript = next(iter(transcript_list))
                    except StopIteration:
                        pass
            
            data = None
            if transcript:
                print(f"[YOUTUBE_PARSER] Using transcript language: {transcript.language} ({transcript.language_code})")
                data = transcript.fetch()
            elif hasattr(YTTA, 'get_transcript'):
                print(f"[YOUTUBE_PARSER] Falling back to direct get_transcript")
                data = YTTA.get_transcript(video_id)
            
            if data:
                full_text = format_transcript_data(data)
                if full_text:
                    return True, full_text, "", None
        else:
            print("[YOUTUBE_PARSER] Warning: YouTubeTranscriptApi class not found in module.")
            errors.append("YouTubeTranscriptApi missing in module")

    except Exception as e:
        err_msg = f"youtube-transcript-api error: {e}"
        print(f"[YOUTUBE_PARSER] {err_msg}")
        errors.append(err_msg)

    # --- ATTEMPT 2: yt-dlp (Robust Fallback) ---
    try:
        import yt_dlp
        print(f"[YOUTUBE_PARSER] Attempting yt-dlp for: {video_id}")
        
        # Configure yt-dlp to only get subtitles
        import sys
        is_windows = sys.platform == "win32"
        
        ydl_opts = {
            'skip_download': True,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['en.*', 'hi.*', '.*'],
            'quiet': True,
            'no_warnings': True,
            'nocheckcertificate': True,
            # AGGRESSIVE: use multiple clients that are less likely to be blocked
            'extractor_args': {
                'youtube': {
                    'player_client': ['web_embedded', 'tvhtml5', 'ios', 'android', 'mweb'],
                    'player_skip': ['web'],
                }
            },
            'user_agent': 'Mozilla/5.0 (PlayStation 5 8.20) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        }
        
        # Only force source_address on Windows where we know it helps
        if is_windows:
            ydl_opts['source_address'] = '0.0.0.0'
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            subtitles = info.get('requested_subtitles') or {}
            
            # Find any available subtitle
            sub_content = None
            for lang, sub_info in subtitles.items():
                if sub_info.get('data'):
                    sub_content = sub_info['data']
                    print(f"[YOUTUBE_PARSER] yt-dlp found subtitle: {lang}")
                    break
            
            if sub_content:
                # yt-dlp data is often in VTT or JSON format
                # If it's a simple string, it might need parsing
                if isinstance(sub_content, str):
                    full_text = parse_vtt_content(sub_content)
                    if full_text:
                        return True, full_text, "", info.get('title')
                
    except Exception as e:
        err_msg = f"yt-dlp error: {e}"
        print(f"[YOUTUBE_PARSER] {err_msg}")
        errors.append(err_msg)

    # --- ATTEMPT 3: pytubefix (Last Resort) ---
    print(f"[YOUTUBE_PARSER] Falling back to pytubefix for: {video_id}")
    for attempt in range(max_retries + 1):
        try:
            from pytubefix import YouTube
            yt = YouTube(
                f"https://www.youtube.com/watch?v={video_id}",
                use_oauth=False,
                allow_oauth_cache=False
            )

            caption = None
            all_captions = list(yt.captions)
            for lang_code in ['en', 'a.en', 'en-US', 'en-GB']:
                for cap in all_captions:
                    if cap.code == lang_code:
                        caption = cap
                        break
                if caption: break

            if not caption and all_captions:
                caption = all_captions[0]

            if caption:
                print(f"[YOUTUBE_PARSER] pytubefix using: {caption.code}")
                # Use standard string format to avoid weird XML issues
                try:
                    full_text = format_pytubefix_captions(caption)
                except:
                    xml_captions = caption.xml_captions
                    full_text = parse_xml_captions(xml_captions)
                
                if full_text:
                    return True, full_text, "", getattr(yt, 'title', None)
            
            if attempt < max_retries:
                time.sleep(1)
                continue

        except Exception as e:
            err_msg = f"pytubefix error (Attempt {attempt+1}): {e}"
            print(f"[YOUTUBE_PARSER] {err_msg}")
            if any(key in str(e).lower() for key in ["errno -5", "name_not_resolved", "connection"]):
                time.sleep(2 ** attempt)
                continue
            errors.append(err_msg)
            break
    
    combined_errors = " | ".join(errors)
    
    # --- ATTEMPT 4: Raw InnerTube API (High Fidelity) ---
    print(f"[YOUTUBE_PARSER] Falling back to Raw InnerTube for: {video_id}")
    success, text, it_err = get_innertube_transcript(video_id)
    if success:
        return True, text, "", None
    
    # --- ATTEMPT 5: Embedded Player Scraping (Last Resort) ---
    print(f"[YOUTUBE_PARSER] Falling back to Embedded Player for: {video_id}")
    success, text, embed_err = get_embedded_transcript(video_id)
    if success:
        return True, text, "", None

    return False, "", f"Transcript fetch failed. Errors: {combined_errors} | InnerTube: {it_err} | Embed: {embed_err}", None

def get_innertube_transcript(video_id: str) -> Tuple[bool, str, str]:
    """Directly call YouTube's InnerTube API with multiple client fallbacks."""
    clients = [
        {"name": "ANDROID_MUSIC", "version": "6.41.53", "ua": "com.google.android.apps.youtube.music/6.41.53 (Linux; U; Android 12)"},
        {"name": "TVHTML5", "version": "7.20240313.00.00", "ua": "Mozilla/5.0 (PlayStation 5 8.20) AppleWebKit/605.1.15"},
        {"name": "IOS", "version": "19.05.36", "ua": "com.google.ios.youtube/19.05.36 (iPhone16,2; OS 17_4_1)"}
    ]
    
    session = requests.Session()
    last_err = "No attempts made"
    
    for client_info in clients:
        try:
            player_url = "https://www.youtube.com/youtubei/v1/player"
            player_payload = {
                "videoId": video_id,
                "context": {
                    "client": {
                        "clientName": client_info["name"],
                        "clientVersion": client_info["version"],
                        "hl": "en",
                    }
                }
            }
            headers = {
                "Content-Type": "application/json",
                "User-Agent": client_info["ua"],
                "X-Goog-Visitor-Id": "Cgt5MWFRS2l2RjB3byippd" # Dummy visitor data
            }
            
            resp = session.post(player_url, headers=headers, json=player_payload, timeout=5).json()
            
            # Look for captions
            captions = resp.get("captions", {}).get("playerCaptionsTracklistRenderer", {})
            tracks = captions.get("captionTracks", [])
            
            if tracks:
                track_url = tracks[0].get("baseUrl")
                if "fmt=" not in track_url: track_url += "&fmt=vtt"
                
                t_resp = session.get(track_url, timeout=5).text
                full_text = parse_xml_captions(t_resp) if "<transcript>" in t_resp else parse_vtt_content(t_resp)
                if full_text:
                    return True, full_text, ""
            
            last_err = resp.get("playabilityStatus", {}).get("reason", "No captions found")
        except Exception as e:
            last_err = str(e)
            continue
            
    return False, "", f"InnerTube all clients failed: {last_err}"

def get_embedded_transcript(video_id: str) -> Tuple[bool, str, str]:
    """Fetch transcript via the embedded player endpoint with improved JSON extraction."""
    try:
        url = f"https://www.youtube.com/embed/{video_id}"
        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Referer": "https://www.youtube.com/",
            "Accept-Language": "en-US,en;q=0.9",
        }
        
        resp = requests.get(url, headers=headers, timeout=5).text
        
        # 1. Try to find ytInitialPlayerResponse
        player_match = re.search(r'ytInitialPlayerResponse\s*=\s*({.*?});', resp)
        # 2. Try to find ytInitialData (sometimes used in newer embeds)
        data_match = re.search(r'ytInitialData\s*=\s*({.*?});', resp)
        
        player_data = None
        if player_match:
            try: player_data = json.loads(player_match.group(1))
            except: pass
        elif data_match:
            try: player_data = json.loads(data_match.group(1))
            except: pass
            
        if player_data:
            # Look for captions in playerCaptionsTracklistRenderer
            captions = player_data.get("captions", {}).get("playerCaptionsTracklistRenderer", {})
            tracks = captions.get("captionTracks", [])
            
            if tracks:
                # Prioritize English
                track = next((t for t in tracks if "en" in t.get("vssId", "").lower()), tracks[0])
                track_url = track.get("baseUrl")
                
                if track_url:
                    # Append fmt=vtt for easier parsing if needed
                    t_resp = requests.get(track_url, timeout=5).text
                    full_text = parse_xml_captions(t_resp) if "<transcript>" in t_resp else parse_vtt_content(t_resp)
                    if full_text:
                        print(f"[YOUTUBE_PARSER] Embedded success for: {video_id}")
                        return True, full_text.strip(), ""
        
        # 3. Last ditch: look for any URL that looks like a caption track in the source
        caption_urls = re.findall(r'\"https://www\.youtube\.com/api/timedtext[^\"]+\"', resp)
        if caption_urls:
            url = caption_urls[0].strip('"').replace('\\u0026', '&')
            if "fmt=" not in url: url += "&fmt=vtt"
            t_resp = requests.get(url, timeout=5).text
            full_text = parse_vtt_content(t_resp)
            if full_text:
                return True, full_text, ""
                        
    except Exception as e:
        return False, "", f"Embedded scraping failed: {e}"
        
    return False, "", "No transcript data found in embedded player source."

def format_pytubefix_captions(caption) -> str:
    """Helper to format pytubefix caption data consistently."""
    # pytubefix captions can be converted to srt or vtt
    vtt_text = caption.generate_srt_captions() # Actually generates SRT, but we can parse it
    # Reuse parse_vtt logic with slight adjustment for SRT if needed
    lines = vtt_text.splitlines()
    full_text = ""
    current_timestamp = "[00:00]"
    
    for line in lines:
        if '-->' in line:
            ts_match = re.search(r'(\d{2}:\d{2}:\d{2})', line)
            if ts_match:
                ts = ts_match.group(1)
                parts = ts.split(':')
                mins = int(parts[0]) * 60 + int(parts[1])
                secs = int(parts[2])
                current_timestamp = f"[{mins:02d}:{secs:02d}]"
            continue
        
        if not line.strip() or line.strip().isdigit():
            continue
            
        text = re.sub(r'<[^>]+>', '', line).strip()
        if text:
            full_text += f"{current_timestamp} {text} \n"
            
    return full_text.strip()

def format_transcript_data(data: list) -> str:
    """Helper to format youtube-transcript-api data."""
    full_text = ""
    for entry in data:
        start_sec = entry['start']
        mins = int(start_sec // 60)
        secs = int(start_sec % 60)
        timestamp = f"[{mins:02d}:{secs:02d}]"
        text = entry['text'].replace('\n', ' ').strip()
        if text:
            full_text += f"{timestamp} {text} \n"
    return full_text.strip()

def parse_vtt_content(vtt_text: str) -> str:
    """Simple parser for VTT content from yt-dlp."""
    lines = vtt_text.splitlines()
    full_text = ""
    current_timestamp = "[00:00]"
    
    for line in lines:
        # Match VTT timestamps: 00:00:04.532 --> 00:00:07.820
        ts_match = re.search(r'(\d{2}:\d{2}:\d{2}.\d{3}) -->', line)
        if ts_match:
            try:
                parts = ts_match.group(1).split(':')
                # We want [MM:SS]
                mins = int(parts[0]) * 60 + int(parts[1])
                secs = int(float(parts[2]))
                current_timestamp = f"[{mins:02d}:{secs:02d}]"
            except:
                pass
            continue
        
        # Skip VTT headers and empty lines
        if "WEBVTT" in line or "Kind:" in line or "Language:" in line or not line.strip():
            continue
        
        # Clean up text
        text = re.sub(r'<[^>]+>', '', line).strip()
        if text and not text.isdigit(): # Skip line numbers if present
            full_text += f"{current_timestamp} {text} \n"
            
    return full_text.strip()

def parse_xml_captions(xml: str) -> str:
    """Convert YouTube's XML caption format to [MM:SS] timestamped text."""
    import xml.etree.ElementTree as ET

    try:
        root = ET.fromstring(xml)
    except ET.ParseError as e:
        print(f"[YOUTUBE_PARSER] XML parse error: {e}")
        return ""

    full_text = ""
    seen_lines = set()

    for element in root.iter():
        if element.tag in ('text', 'p') and element.text:
            start_attr = element.get('start') or element.get('t', '0')
            try:
                start_sec = float(start_attr)
                if start_sec > 10000:
                    start_sec = start_sec / 1000.0
            except (ValueError, TypeError):
                start_sec = 0.0

            mins = int(start_sec // 60)
            secs = int(start_sec % 60)
            timestamp = f"[{mins:02d}:{secs:02d}]"

            text = re.sub(r'<[^>]+>', '', element.text)
            text = text.replace('&#39;', "'").replace('&amp;', '&').replace('&quot;', '"').strip()

            if text and text not in seen_lines:
                full_text += f"{timestamp} {text} \n"
                seen_lines.add(text)

    return full_text.strip()
