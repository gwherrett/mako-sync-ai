#!/usr/bin/env python3
"""
Diagnose comment field differences between MediaMonkey and Serato
"""

import sys
import os
from mutagen.id3 import ID3

# Fix Windows console encoding
if os.name == 'nt':
    sys.stdout.reconfigure(encoding='utf-8')

def diagnose_comments(filepath):
    """Show ALL comment-related fields in detail"""
    print("=" * 80)
    print(f"COMMENT FIELD DIAGNOSIS: {filepath}")
    print("=" * 80)

    try:
        audio = ID3(filepath)

        print("\n🔍 ALL COMMENT FRAMES (COMM):")
        print("-" * 80)
        comm_count = 0

        for key, value in sorted(audio.items()):
            if key.startswith('COMM'):
                comm_count += 1
                print(f"\nFrame Key: {key}")
                print(f"  Description: {value.desc if hasattr(value, 'desc') else 'N/A'}")
                print(f"  Language: {value.lang if hasattr(value, 'lang') else 'N/A'}")
                print(f"  Text: {value.text if hasattr(value, 'text') else 'N/A'}")
                print(f"  Encoding: {value.encoding if hasattr(value, 'encoding') else 'N/A'}")

        if comm_count == 0:
            print("  ❌ No COMM frames found")
        else:
            print(f"\n📊 Total COMM frames: {comm_count}")

        # Check for user-defined text frames that might be used for comments
        print("\n\n🔍 USER-DEFINED TEXT FRAMES (TXXX):")
        print("-" * 80)
        txxx_count = 0

        for key, value in sorted(audio.items()):
            if key.startswith('TXXX'):
                txxx_count += 1
                desc = value.desc if hasattr(value, 'desc') else 'Unknown'
                if 'comment' in desc.lower() or 'custom' in desc.lower():
                    print(f"\nFrame Key: {key}")
                    print(f"  Description: {desc}")
                    print(f"  Text: {value.text if hasattr(value, 'text') else 'N/A'}")

        if txxx_count == 0:
            print("  ❌ No comment-related TXXX frames found")

        # Summary for quick reference
        print("\n\n" + "=" * 80)
        print("SUMMARY - WHAT EACH APP MIGHT SEE:")
        print("=" * 80)

        # MediaMonkey typically reads COMM:: (no description, default language)
        mm_comment = audio.get('COMM::eng') or audio.get('COMM::XXX') or audio.get('COMM::')
        print(f"\nMediaMonkey (COMM::eng or COMM::XXX):")
        if mm_comment:
            print(f"  ✅ {mm_comment.text[0] if mm_comment.text else 'Empty'}")
        else:
            print(f"  ❌ Not found")

        # Serato might read from specific description or iTunNORM
        serato_comment = None
        for key, value in audio.items():
            if key.startswith('COMM') and value.desc == '':
                serato_comment = value
                break

        print(f"\nSerato (COMM with empty description):")
        if serato_comment:
            print(f"  ✅ {serato_comment.text[0] if serato_comment.text else 'Empty'}")
        else:
            print(f"  ❌ Not found")

        # Custom fields
        custom_fields = [key for key in audio.keys() if 'Songs-DB_Custom' in key or 'CUSTOM' in key.upper()]
        if custom_fields:
            print(f"\nCustom Fields (Songs-DB_Custom1, etc.):")
            for key in custom_fields:
                value = audio[key]
                desc = value.desc if hasattr(value, 'desc') else key
                text = value.text[0] if hasattr(value, 'text') and value.text else str(value)
                print(f"  {desc}: {text}")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python diagnose_comments.py <path_to_mp3_file>")
        print("\nExample:")
        print('  python diagnose_comments.py "C:\\Music\\song.mp3"')
        sys.exit(1)

    filepath = sys.argv[1]
    diagnose_comments(filepath)
