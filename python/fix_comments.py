#!/usr/bin/env python3
"""
Fix comment field conflicts by removing iTunes normalization data
from comment fields and preserving Songs-DB_Custom1
"""

import sys
import os
from mutagen.id3 import ID3

# Fix Windows console encoding
if os.name == 'nt':
    sys.stdout.reconfigure(encoding='utf-8')

def fix_comment_fields(filepath, dry_run=True):
    """Remove problematic comment fields, keep Songs-DB_Custom1"""
    print("=" * 80)
    print(f"FIXING: {filepath}")
    print("=" * 80)

    try:
        audio = ID3(filepath)

        print("\n📋 BEFORE:")
        print("-" * 80)
        for key, value in sorted(audio.items()):
            if key.startswith('COMM'):
                desc = value.desc if hasattr(value, 'desc') else 'Unknown'
                text = value.text[0] if hasattr(value, 'text') and value.text else ''
                text_preview = text[:60] + "..." if len(text) > 60 else text
                print(f"  {key}")
                print(f"    Description: {desc}")
                print(f"    Text: {text_preview}")

        # Identify fields to remove
        to_remove = []
        custom1_value = None

        for key, value in audio.items():
            if key.startswith('COMM'):
                desc = value.desc if hasattr(value, 'desc') else ''
                lang = value.lang if hasattr(value, 'lang') else ''
                text = value.text[0] if hasattr(value, 'text') and value.text else ''

                # Keep Songs-DB_Custom1
                if desc == 'Songs-DB_Custom1':
                    custom1_value = text
                    print(f"\n✅ Keeping: {key} = '{text}'")
                # Remove COMM:ID3v1 Comment:eng
                elif desc == 'ID3v1 Comment' and lang == 'eng':
                    to_remove.append(key)
                    text_preview = text[:50] + "..." if len(text) > 50 else text
                    print(f"\n🗑️  Will remove: {key}")
                    print(f"    Description: '{desc}'")
                    print(f"    Text: '{text_preview}'")
                # Remove COMM::XXX (empty description, XXX language)
                elif desc == '' and lang == 'XXX':
                    to_remove.append(key)
                    text_preview = text[:50] + "..." if len(text) > 50 else text
                    print(f"\n🗑️  Will remove: {key}")
                    print(f"    Description: (empty)")
                    print(f"    Language: XXX")
                    print(f"    Text: '{text_preview}'")
                else:
                    # Show other fields that will be kept
                    print(f"\n⚠️  Keeping other field: {key}")
                    print(f"    Description: '{desc}'")
                    print(f"    Language: '{lang}'")

        if not to_remove:
            print("\n✅ No problematic comment fields found. File is OK!")
            return

        if dry_run:
            print("\n" + "=" * 80)
            print("🔍 DRY RUN - No changes made")
            print("=" * 80)
            print(f"\nWould remove {len(to_remove)} comment field(s)")
            print("Run with --apply to make actual changes")
        else:
            # Remove problematic fields
            for key in to_remove:
                del audio[key]

            # Save changes
            audio.save()

            print("\n" + "=" * 80)
            print("✅ CHANGES APPLIED")
            print("=" * 80)
            print(f"\nRemoved {len(to_remove)} comment field(s)")

            # Show after state
            print("\n📋 AFTER:")
            print("-" * 80)
            audio = ID3(filepath)  # Reload
            for key, value in sorted(audio.items()):
                if key.startswith('COMM'):
                    desc = value.desc if hasattr(value, 'desc') else 'Unknown'
                    text = value.text[0] if hasattr(value, 'text') and value.text else ''
                    print(f"  {key}")
                    print(f"    Description: {desc}")
                    print(f"    Text: {text}")

            print("\n✅ File fixed successfully!")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

def batch_fix(directory, dry_run=True):
    """Fix all MP3 files in a directory"""
    import glob

    pattern = os.path.join(directory, "**", "*.mp3")
    files = glob.glob(pattern, recursive=True)

    print(f"Found {len(files)} MP3 files in {directory}")
    print("=" * 80)

    fixed_count = 0
    for filepath in files:
        try:
            audio = ID3(filepath)
            # Check if file has multiple comment fields or non-Custom1 comments
            has_problem = False
            comm_count = 0
            has_custom1 = False

            for key, value in audio.items():
                if key.startswith('COMM'):
                    comm_count += 1
                    desc = value.desc if hasattr(value, 'desc') else ''
                    lang = value.lang if hasattr(value, 'lang') else ''

                    if desc == 'Songs-DB_Custom1':
                        has_custom1 = True
                    # Check for ID3v1 Comment:eng or empty description with XXX lang
                    elif (desc == 'ID3v1 Comment' and lang == 'eng') or (desc == '' and lang == 'XXX'):
                        has_problem = True

            # Fix if there are problematic comment fields
            if has_problem:
                print(f"\n🔧 {filepath}")
                fix_comment_fields(filepath, dry_run)
                fixed_count += 1
        except:
            continue

    print("\n" + "=" * 80)
    print(f"📊 SUMMARY: {fixed_count} files need fixing")
    print("=" * 80)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  Single file: python fix_comments.py <file.mp3> [--apply]")
        print("  Batch mode:  python fix_comments.py --batch <directory> [--apply]")
        print("\nOptions:")
        print("  --apply     Actually make changes (default is dry-run)")
        print("\nExamples:")
        print('  python fix_comments.py "song.mp3"')
        print('  python fix_comments.py "song.mp3" --apply')
        print('  python fix_comments.py --batch "C:\\Music" --apply')
        sys.exit(1)

    apply_changes = '--apply' in sys.argv
    dry_run = not apply_changes

    if '--batch' in sys.argv:
        batch_idx = sys.argv.index('--batch')
        if batch_idx + 1 < len(sys.argv):
            directory = sys.argv[batch_idx + 1]
            batch_fix(directory, dry_run)
        else:
            print("Error: --batch requires a directory path")
    else:
        filepath = sys.argv[1]
        fix_comment_fields(filepath, dry_run)
