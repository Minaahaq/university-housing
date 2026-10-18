#!/usr/bin/env python3
"""
توليد كل أيقونات PWA من صورة مصدر واحدة.
الاستخدام:
    python3 scripts/generate-icons.py [path-to-source-image]
مثال:
    python3 scripts/generate-icons.py public/icons/base.png
"""
import sys
import os
import subprocess

# الأبعاد المطلوبة
SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

# الحجم الافتراضي إذا لم تُمرر صورة
DEFAULT_OUTPUT_DIR = 'public/icons'

def ensure_pillow():
    """تأكد من تثبيت Pillow، وإلا ثبّته."""
    try:
        from PIL import Image
        return True
    except ImportError:
        print('📦 Pillow غير مثبت. جارٍ التثبيت...')
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--quiet', 'Pillow'])
            print('✅ تم تثبيت Pillow')
            return True
        except Exception as e:
            print(f'❌ فشل تثبيت Pillow: {e}')
            print('   جرّب: pip3 install Pillow')
            return False

def create_default_source(path):
    """إنشاء صورة مصدر افتراضية (🏠 على خلفية بنفسجية)."""
    from PIL import Image, ImageDraw, ImageFont

    size = 512
    img = Image.new('RGB', (size, size), '#635bff')
    draw = ImageDraw.Draw(img)

    # حاول رسم إيموجي 🏠
    emoji = '🏠'
    font = None
    for f in [
        '/System/Library/Fonts/Apple Color Emoji.ttc',
        '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    ]:
        if os.path.exists(f):
            try:
                font = ImageFont.truetype(f, 340)
                break
            except:
                pass

    if font:
        # وسط الصورة
        bbox = draw.textbbox((0, 0), emoji, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        draw.text(
            ((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1] - 20),
            emoji, font=font, fill='white'
        )
    else:
        # بديل: مستطيلات تمثل بيتًا
        draw.rectangle([156, 256, 356, 400], fill='white')
        draw.polygon([(128, 256), (256, 128), (384, 256)], fill='white')

    img.save(path)
    print(f'✅ تم إنشاء صورة مصدر افتراضية: {path}')

def generate_icons(source_path, output_dir):
    """توليد كل الأحجام من الصورة المصدر."""
    from PIL import Image

    if not os.path.exists(source_path):
        print(f'⚠️  الصورة المصدر غير موجودة: {source_path}')
        create_default_source(source_path)

    os.makedirs(output_dir, exist_ok=True)
    base = Image.open(source_path).convert('RGBA')
    print(f'📷 الصورة المصدر: {source_path} ({base.size[0]}x{base.size[1]})')

    for size in SIZES:
        icon = base.resize((size, size), Image.LANCZOS)
        out = os.path.join(output_dir, f'icon-{size}x{size}.png')
        icon.save(out, 'PNG', optimize=True)
        print(f'   ✅ {out}')

    # maskable (512x512 مع حشوة 10% للخلفية)
    maskable = Image.new('RGBA', (512, 512), (99, 91, 255, 255))
    inner = base.resize((410, 410), Image.LANCZOS)
    maskable.paste(inner, ((512 - 410) // 2, (512 - 410) // 2), inner)
    maskable_out = os.path.join(output_dir, 'icon-maskable-512x512.png')
    maskable.save(maskable_out, 'PNG', optimize=True)
    print(f'   ✅ {maskable_out}')

    # favicon.ico (32x32)
    favicon_path = os.path.join(output_dir, '..', 'favicon.ico')
    base.resize((32, 32), Image.LANCZOS).save(favicon_path, 'ICO')
    print(f'   ✅ {os.path.normpath(favicon_path)}')

def main():
    if not ensure_pillow():
        sys.exit(1)

    source_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(DEFAULT_OUTPUT_DIR, 'base.png')
    output_dir = DEFAULT_OUTPUT_DIR

    print('🚀 بدء توليد الأيقونات...\n')
    generate_icons(source_path, output_dir)
    print('\n🎉 اكتمل! كل الأيقونات جاهزة في:', output_dir)

if __name__ == '__main__':
    main()
