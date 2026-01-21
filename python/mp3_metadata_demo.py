#!/usr/bin/env python3
"""
Mutagen MP3 Metadata Demo Script
Demonstrates basic commands for reading MP3 metadata
"""

import sys
import os
from mutagen.mp3 import MP3
from mutagen.id3 import ID3
from mutagen.easyid3 import EasyID3

# Fix Windows console encoding
if os.name == 'nt':
    sys.stdout.reconfigure(encoding='utf-8')

def inspect_mp3_detailed(filepath):
    """Show all metadata in detailed format"""
    print("=" * 80)
    print(f"DETAILED INSPECTION: {filepath}")
    print("=" * 80)

    try:
        # Load the MP3 file
        audio = MP3(filepath)

        # Basic file info
        print(f"\n📁 FILE INFO:")
        print(f"   Length: {audio.info.length:.2f} seconds ({audio.info.length/60:.2f} minutes)")
        print(f"   Bitrate: {audio.info.bitrate} bps ({audio.info.bitrate/1000:.0f} kbps)")
        print(f"   Sample Rate: {audio.info.sample_rate} Hz")
        print(f"   Channels: {audio.info.channels}")
        print(f"   Encoder: {getattr(audio.info, 'encoder_info', 'Unknown')}")

        # All ID3 tags (raw format)
        print(f"\n🏷️  ALL ID3 TAGS (RAW):")
        if audio.tags:
            for key, value in sorted(audio.tags.items()):
                print(f"   {key}: {value}")
        else:
            print("   No tags found")

    except Exception as e:
        print(f"❌ Error: {e}")

def inspect_mp3_easy(filepath):
    """Show metadata in easy-to-read format"""
    print("\n" + "=" * 80)
    print(f"EASY FORMAT: {filepath}")
    print("=" * 80)

    try:
        # Use EasyID3 for simplified tag access
        audio = EasyID3(filepath)

        print(f"\n🎵 COMMON METADATA:")
        common_tags = ['title', 'artist', 'album', 'albumartist', 'date', 'genre',
                      'tracknumber', 'discnumber', 'composer', 'comment']

        for tag in common_tags:
            if tag in audio:
                print(f"   {tag.upper()}: {', '.join(audio[tag])}")

        print(f"\n📋 ALL AVAILABLE TAGS:")
        for key, value in sorted(audio.items()):
            print(f"   {key}: {', '.join(value)}")

    except Exception as e:
        print(f"❌ Error: {e}")

def inspect_mp3_summary(filepath):
    """Show quick summary"""
    print("\n" + "=" * 80)
    print(f"QUICK SUMMARY: {filepath}")
    print("=" * 80)

    try:
        audio = EasyID3(filepath)
        mp3 = MP3(filepath)

        title = audio.get('title', ['Unknown'])[0]
        artist = audio.get('artist', ['Unknown'])[0]
        album = audio.get('album', ['Unknown'])[0]
        genre = audio.get('genre', ['Unknown'])[0]
        duration = mp3.info.length
        bitrate = mp3.info.bitrate / 1000

        print(f"""
   🎵 Title:   {title}
   🎤 Artist:  {artist}
   💿 Album:   {album}
   🎸 Genre:   {genre}
   ⏱️  Duration: {duration/60:.2f} min
   📊 Bitrate: {bitrate:.0f} kbps
        """)

    except Exception as e:
        print(f"❌ Error: {e}")

def inspect_custom_fields(filepath):
    """Show all custom/comment fields"""
    print("\n" + "=" * 80)
    print(f"CUSTOM FIELDS: {filepath}")
    print("=" * 80)

    try:
        audio = ID3(filepath)

        # Find all COMM (Comment) frames
        print(f"\n💬 COMMENT FIELDS:")
        comm_found = False
        for key, value in sorted(audio.items()):
            if key.startswith('COMM'):
                comm_found = True
                # Parse the COMM frame
                desc = value.desc if hasattr(value, 'desc') else 'Unknown'
                text = value.text[0] if hasattr(value, 'text') and value.text else str(value)
                print(f"   {desc}: {text}")

        if not comm_found:
            print("   No comment fields found")

        # Find all TXXX (User-defined text) frames
        print(f"\n🏷️  USER-DEFINED TEXT FIELDS:")
        txxx_found = False
        for key, value in sorted(audio.items()):
            if key.startswith('TXXX'):
                txxx_found = True
                desc = value.desc if hasattr(value, 'desc') else 'Unknown'
                text = value.text[0] if hasattr(value, 'text') and value.text else str(value)
                print(f"   {desc}: {text}")

        if not txxx_found:
            print("   No user-defined text fields found")

    except Exception as e:
        print(f"❌ Error: {e}")

def list_all_supported_tags():
    """Show all tags that EasyID3 supports"""
    print("\n" + "=" * 80)
    print("SUPPORTED EASY TAGS")
    print("=" * 80)
    print("\nTags you can read/write with EasyID3:")
    for tag in sorted(EasyID3.valid_keys.keys()):
        print(f"   - {tag}")

# Main execution
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python mp3_metadata_demo.py <path_to_mp3_file> [mode]")
        print("\nModes:")
        print("  summary  - Quick overview (default)")
        print("  easy     - Easy-to-read format")
        print("  detailed - All raw ID3 tags")
        print("  custom   - Show custom/comment fields")
        print("  tags     - List all supported tag names")
        print("\nExample:")
        print('  python mp3_metadata_demo.py "C:\\Music\\song.mp3"')
        print('  python mp3_metadata_demo.py "C:\\Music\\song.mp3" custom')
        sys.exit(1)

    filepath = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else "summary"

    if mode == "tags":
        list_all_supported_tags()
    elif mode == "detailed":
        inspect_mp3_detailed(filepath)
    elif mode == "easy":
        inspect_mp3_easy(filepath)
    elif mode == "custom":
        inspect_custom_fields(filepath)
    elif mode == "summary":
        inspect_mp3_summary(filepath)
    else:
        print(f"Unknown mode: {mode}")
        print("Use: summary, easy, detailed, custom, or tags")
