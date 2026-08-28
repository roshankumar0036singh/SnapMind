import re
import os
import time
import requests
import json
import ssl
from typing import Tuple, List, Dict, Any
from api_clients import get_firecrawl_key
import asyncio

# Bypass strict SSL interception that causes CERTIFICATE_VERIFY_FAILED or UNEXPECTED_EOF
try:
    ssl._create_default_https_context = ssl._create_unverified_context
except AttributeError:
    pass

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

def _fetch_title(video_id: str) -> str | None:
    """Fast title fetch via YouTube's public oEmbed endpoint (no auth needed)."""
    try:
        resp = requests.get(
            f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json",
            timeout=3
        )
        if resp.ok:
            return resp.json().get("title")
    except Exception:
        pass
    return None

def get_youtube_transcript(url: str, api_keys: dict = None) -> Tuple[bool, str, str, str | None]:
    """
    Orchestrates YouTube transcript extraction with a global timeout.
    """
    import threading

    def _run_with_timeout(func, args, timeout):
        result = [False, "", "Global timeout exceeded", None]
        def _wrapper():
            try:
                result[0], result[1], result[2], result[3] = func(*args)
            except Exception as e:
                result[2] = f"Unhandled error: {e}"

        thread = threading.Thread(target=_wrapper)
        thread.start()
        thread.join(timeout)
        if thread.is_alive():
            print(f"[YOUTUBE_PARSER] Global timeout ({timeout}s) exceeded for {url}")
        return tuple(result)

    return _run_with_timeout(_get_youtube_transcript_internal, (url,), 60.0)

def _get_youtube_transcript_internal(url: str) -> Tuple[bool, str, str, str | None]:
    """
    Fetches the transcript for a YouTube video using a robust hybrid approach:
    1. Primary: youtube-transcript-api (Fast, official-ish API)
    2. Secondary: Raw InnerTube API
    3. Third: Embedded Player Scraping
    4. Fourth: pytubefix
    5. Fallback: yt-dlp
    Returns: (is_success, text_content, error_message, title)
    """
    video_id = extract_video_id(url)
    if not video_id:
        return False, "", "Invalid YouTube URL format.", None

    errors = []
    
    # Pre-fetch title
    title = _fetch_title(video_id)

    # --- ATTEMPT 1: youtube-transcript-api (v1.2.4 compat) ---
    try:
        print(f"[YOUTUBE_PARSER] Attempting youtube-transcript-api for: {video_id}")
        from youtube_transcript_api import YouTubeTranscriptApi
        ytt_api = YouTubeTranscriptApi()
        transcript_data = ytt_api.fetch(video_id, languages=['en', 'en-US', 'en-GB', 'a.en'])
        if transcript_data:
            full_text = format_transcript_data(transcript_data)
            if full_text:
                return True, full_text, "", title
    except Exception as e:
        err_msg = f"youtube-transcript-api error: {e}"
        print(f"[YOUTUBE_PARSER] {err_msg}")
        errors.append(err_msg)

    # --- ATTEMPT 2: Raw InnerTube API (Fast & High Fidelity) ---
    print(f"[YOUTUBE_PARSER] Falling back to Raw InnerTube for: {video_id}")
    success, text, it_err = get_innertube_transcript(video_id)
    if success:
        return True, text, "", title
    errors.append(f"InnerTube error: {it_err}")
    
    # --- ATTEMPT 3: Embedded Player Scraping (Fast & Reliable) ---
    print(f"[YOUTUBE_PARSER] Falling back to Embedded Player for: {video_id}")
    success, text, embed_err = get_embedded_transcript(video_id)
    if success:
        return True, text, "", title
    errors.append(f"Embedded error: {embed_err}")

    # --- ATTEMPT 4: pytubefix ---
    print(f"[YOUTUBE_PARSER] Falling back to pytubefix for: {video_id}")
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
            try:
                full_text = format_pytubefix_captions(caption)
            except:
                xml_captions = caption.xml_captions
                full_text = parse_xml_captions(xml_captions)
            
            if full_text:
                if not title:
                    title = getattr(yt, 'title', None)
                return True, full_text, "", title

    except Exception as e:
        err_msg = f"pytubefix error: {e}"
        print(f"[YOUTUBE_PARSER] {err_msg}")
        errors.append(err_msg)

    # --- ATTEMPT 5: yt-dlp (Robust but Heavy/Slow Fallback) ---
    try:
        import yt_dlp
        print(f"[YOUTUBE_PARSER] Attempting yt-dlp for: {video_id}")
        
        ydl_opts = {
            'skip_download': True,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['en.*', 'hi.*', '.*'],
            'quiet': True,
            'no_warnings': True,
            'nocheckcertificate': True,
            'extractor_args': {
                'youtube': {
                    'player_client': ['web_embedded', 'tvhtml5', 'ios', 'android', 'mweb'],
                    'player_skip': ['web'],
                }
            },
            'user_agent': 'Mozilla/5.0 (PlayStation 5 8.20) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            subtitles = info.get('requested_subtitles') or {}
            
            sub_content = None
            for lang, sub_info in subtitles.items():
                if sub_info.get('data'):
                    sub_content = sub_info['data']
                    print(f"[YOUTUBE_PARSER] yt-dlp found subtitle: {lang}")
                    break
            
            if sub_content:
                if isinstance(sub_content, str):
                    full_text = parse_vtt_content(sub_content)
                    if full_text:
                        if not title:
                            title = info.get('title')
                        return True, full_text, "", title
                
    except Exception as e:
        err_msg = f"yt-dlp error: {e}"
        print(f"[YOUTUBE_PARSER] {err_msg}")
        errors.append(err_msg)

    combined_errors = " | ".join(errors)
    return False, "", f"Transcript fetch failed. Errors: {combined_errors}", title

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
            
            resp = session.post(player_url, headers=headers, json=player_payload, timeout=3).json()
            
            # Look for captions
            captions = resp.get("captions", {}).get("playerCaptionsTracklistRenderer", {})
            tracks = captions.get("captionTracks", [])
            
            if tracks:
                track_url = tracks[0].get("baseUrl")
                if "fmt=" not in track_url: track_url += "&fmt=vtt"
                
                t_resp = session.get(track_url, timeout=3).text
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
        
        resp = requests.get(url, headers=headers, timeout=3).text
        
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
                    t_resp = requests.get(track_url, timeout=3).text
                    full_text = parse_xml_captions(t_resp) if "<transcript>" in t_resp else parse_vtt_content(t_resp)
                    if full_text:
                        print(f"[YOUTUBE_PARSER] Embedded success for: {video_id}")
                        return True, full_text.strip(), ""
        
        # 3. Last ditch: look for any URL that looks like a caption track in the source
        caption_urls = re.findall(r'\"https://www\.youtube\.com/api/timedtext[^\"]+\"', resp)
        if caption_urls:
            url = caption_urls[0].strip('"').replace('\\u0026', '&')
            if "fmt=" not in url: url += "&fmt=vtt"
            t_resp = requests.get(url, timeout=3).text
            full_text = parse_vtt_content(t_resp)
            if full_text:
                return True, full_text, ""
                        
    except Exception as e:
        return False, "", f"Embedded scraping failed: {e}"
        
    return False, "", "No transcript data found in embedded player source."

def format_pytubefix_captions(caption) -> str:
    """Helper to format pytubefix caption data consistently."""
    vtt_text = caption.generate_srt_captions()
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
        if isinstance(entry, dict):
            start_sec = entry.get('start', 0)
            text = entry.get('text', '')
        else:
            start_sec = getattr(entry, 'start', 0)
            text = getattr(entry, 'text', '')
            
        mins = int(start_sec // 60)
        secs = int(start_sec % 60)
        timestamp = f"[{mins:02d}:{secs:02d}]"
        text = text.replace('\n', ' ').strip()
        if text:
            full_text += f"{timestamp} {text} \n"
    return full_text.strip()

def parse_vtt_content(vtt_text: str) -> str:
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
