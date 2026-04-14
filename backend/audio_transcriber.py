"""
Audio & Video Transcription Module for SnapMind.

Supports .mp3, .wav, .m4a, .ogg, .flac audio files and .mp4/.mkv/.avi/.mov video
files (e.g. Zoom recordings). Uses Groq Whisper API for transcription.
"""

import os
import io
import tempfile
from typing import Dict, Any


class AudioTranscriber:
    """Transcribes audio/video files using Groq Whisper API."""

    SUPPORTED_AUDIO = {'.mp3', '.wav', '.m4a', '.ogg', '.flac', '.webm', '.wma'}
    SUPPORTED_VIDEO = {'.mp4', '.mkv', '.avi', '.mov', '.webm'}
    MAX_CHUNK_SIZE = 24 * 1024 * 1024  # 24MB per chunk (Groq limit is 25MB, leave headroom)

    def __init__(self, api_keys: dict = None):
        self.api_keys = api_keys or {}

    def transcribe(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        """
        Transcribes an audio or video file to timestamped text.

        Args:
            file_bytes: Raw file bytes
            filename: Original filename (used for extension detection)

        Returns:
            {"success": bool, "text": str, "duration_seconds": float, "language": str, "error": str}
        """
        ext = os.path.splitext(filename)[1].lower()

        print(f"[AUDIO] Processing {filename} ({len(file_bytes)} bytes, ext={ext})")

        # 1. If video → extract audio track first
        if ext in self.SUPPORTED_VIDEO:
            print(f"[AUDIO] Video file detected. Extracting audio track...")
            try:
                audio_bytes = self._extract_audio_from_video(file_bytes, filename)
                if not audio_bytes:
                    return {"success": False, "text": "", "error": "Failed to extract audio from video"}
                file_bytes = audio_bytes
                filename = filename.rsplit('.', 1)[0] + '.mp3'
                print(f"[AUDIO] Extracted audio: {len(file_bytes)} bytes")
            except Exception as e:
                return {"success": False, "text": "", "error": f"Audio extraction failed: {str(e)}"}

        # 2. Chunk if file > limit
        if len(file_bytes) > self.MAX_CHUNK_SIZE:
            print(f"[AUDIO] File exceeds {self.MAX_CHUNK_SIZE // (1024*1024)}MB. Chunking...")
            return self._transcribe_chunked(file_bytes, filename)

        # 3. Direct transcription
        return self._transcribe_groq(file_bytes, filename)

    def _transcribe_groq(self, audio_bytes: bytes, filename: str) -> Dict[str, Any]:
        """Direct Groq Whisper API call with segment-level timestamps."""
        try:
            from groq import Groq
        except ImportError:
            return {"success": False, "text": "", "error": "groq package not installed. Run: pip install groq"}

        groq_key = self.api_keys.get("groq") or os.getenv("GROQ_API_KEY")
        if not groq_key:
            return {"success": False, "text": "", "error": "No Groq API key configured. Set GROQ_API_KEY env var."}

        try:
            client = Groq(api_key=groq_key)

            # Prepare file-like object
            audio_file = io.BytesIO(audio_bytes)
            audio_file.name = filename

            print(f"[AUDIO] Sending to Groq Whisper ({len(audio_bytes)} bytes)...")
            transcription = client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-large-v3-turbo",
                response_format="verbose_json",
                timestamp_granularities=["segment"]
            )

            # Format with timestamps for citation support (same format as YouTube transcripts)
            formatted_text = ""
            segments = getattr(transcription, 'segments', None) or []

            if segments:
                for segment in segments:
                    start = getattr(segment, 'start', 0) or 0
                    text = getattr(segment, 'text', '').strip()
                    if text:
                        mins = int(start // 60)
                        secs = int(start % 60)
                        formatted_text += f"[{mins:02d}:{secs:02d}] {text}\n"
            else:
                # Fallback: use plain text if segments aren't available
                formatted_text = getattr(transcription, 'text', '') or str(transcription)

            duration = getattr(transcription, 'duration', 0) or 0
            language = getattr(transcription, 'language', 'unknown') or 'unknown'

            print(f"[AUDIO] Transcription complete: {len(formatted_text)} chars, "
                  f"{duration:.0f}s, lang={language}")

            return {
                "success": True,
                "text": formatted_text,
                "duration_seconds": duration,
                "language": language
            }

        except Exception as e:
            error_msg = str(e)
            print(f"[AUDIO] Groq Whisper error: {error_msg}")
            return {"success": False, "text": "", "error": f"Transcription failed: {error_msg}"}

    def _extract_audio_from_video(self, video_bytes: bytes, filename: str) -> bytes:
        """
        Extract audio track from video file.
        Tries pydub first (requires ffmpeg), falls back to moviepy.
        """
        ext = os.path.splitext(filename)[1].lower()

        # Write video to temp file
        tmp_video = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
        try:
            tmp_video.write(video_bytes)
            tmp_video.close()

            # Try pydub (lightweight, requires ffmpeg)
            try:
                from pydub import AudioSegment
                print("[AUDIO] Extracting audio via pydub...")
                audio = AudioSegment.from_file(tmp_video.name)
                buffer = io.BytesIO()
                # Export as mp3 with moderate bitrate to control file size
                audio.export(buffer, format="mp3", bitrate="64k")
                return buffer.getvalue()
            except ImportError:
                print("[AUDIO] pydub not available, trying moviepy...")
            except Exception as e:
                print(f"[AUDIO] pydub extraction failed: {e}, trying moviepy...")

            # Fallback: moviepy
            try:
                from moviepy.editor import VideoFileClip
                print("[AUDIO] Extracting audio via moviepy...")
                tmp_audio = tempfile.NamedTemporaryFile(suffix='.mp3', delete=False)
                tmp_audio.close()

                clip = VideoFileClip(tmp_video.name)
                clip.audio.write_audiofile(tmp_audio.name, verbose=False, logger=None)
                clip.close()

                with open(tmp_audio.name, 'rb') as f:
                    audio_bytes = f.read()
                os.unlink(tmp_audio.name)
                return audio_bytes
            except ImportError:
                print("[AUDIO] moviepy not available either.")
                raise ImportError("Neither pydub nor moviepy installed. Install: pip install pydub")

        finally:
            try:
                os.unlink(tmp_video.name)
            except OSError:
                pass

    def _transcribe_chunked(self, audio_bytes: bytes, filename: str) -> Dict[str, Any]:
        """
        Split large audio files into chunks and transcribe each sequentially.
        Uses pydub for audio splitting.
        """
        try:
            from pydub import AudioSegment
        except ImportError:
            # If pydub isn't available, try transcribing the first 24MB directly
            print("[AUDIO] pydub not available for chunking. Transcribing first 24MB only.")
            return self._transcribe_groq(audio_bytes[:self.MAX_CHUNK_SIZE], filename)

        try:
            audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
        except Exception as e:
            print(f"[AUDIO] Failed to load audio for chunking: {e}")
            return self._transcribe_groq(audio_bytes[:self.MAX_CHUNK_SIZE], filename)

        # Split into 8-minute chunks (reasonably sized for API limits)
        chunk_duration_ms = 8 * 60 * 1000
        full_text = ""
        total_duration = len(audio) / 1000.0  # Convert ms to seconds
        detected_language = "unknown"
        chunks_processed = 0

        for i in range(0, len(audio), chunk_duration_ms):
            chunk = audio[i:i + chunk_duration_ms]
            offset_seconds = i / 1000.0

            # Export chunk as mp3
            buffer = io.BytesIO()
            chunk.export(buffer, format="mp3", bitrate="64k")
            chunk_bytes = buffer.getvalue()

            print(f"[AUDIO] Transcribing chunk {chunks_processed + 1} "
                  f"(offset={offset_seconds:.0f}s, size={len(chunk_bytes)} bytes)...")

            result = self._transcribe_groq(chunk_bytes, f"chunk_{chunks_processed}.mp3")
            if result["success"]:
                # Adjust timestamps by adding the offset
                for line in result["text"].split("\n"):
                    line = line.strip()
                    if not line:
                        continue

                    # Parse existing timestamp and add offset
                    import re
                    ts_match = re.match(r'\[(\d{2}):(\d{2})\]\s*(.*)', line)
                    if ts_match:
                        orig_mins = int(ts_match.group(1))
                        orig_secs = int(ts_match.group(2))
                        total_secs = orig_mins * 60 + orig_secs + int(offset_seconds)
                        new_mins = total_secs // 60
                        new_secs = total_secs % 60
                        full_text += f"[{new_mins:02d}:{new_secs:02d}] {ts_match.group(3)}\n"
                    else:
                        full_text += line + "\n"

                if result.get("language") and result["language"] != "unknown":
                    detected_language = result["language"]
            else:
                print(f"[AUDIO] Chunk {chunks_processed + 1} transcription failed: {result.get('error')}")

            chunks_processed += 1

        return {
            "success": bool(full_text.strip()),
            "text": full_text,
            "duration_seconds": total_duration,
            "language": detected_language
        }


def is_audio_file(filename: str) -> bool:
    """Check if a filename is a supported audio format."""
    ext = os.path.splitext(filename)[1].lower()
    return ext in AudioTranscriber.SUPPORTED_AUDIO


def is_video_file(filename: str) -> bool:
    """Check if a filename is a supported video format."""
    ext = os.path.splitext(filename)[1].lower()
    return ext in AudioTranscriber.SUPPORTED_VIDEO
