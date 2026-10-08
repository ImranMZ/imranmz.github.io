import sys
import pypdfium2 as pdfium

src = sys.argv[1]
out_prefix = sys.argv[2]
scale = float(sys.argv[3]) if len(sys.argv) > 3 else 1.6

pdf = pdfium.PdfDocument(src)
print(f"pages: {len(pdf)}")
for index in range(len(pdf)):
    page = pdf[index]
    bitmap = page.render(scale=scale)
    image = bitmap.to_pil()
    path = f"{out_prefix}-{index + 1}.png"
    image.save(path)
    print(f"wrote {path} ({image.width}x{image.height})")