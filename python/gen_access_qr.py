import qrcode
from pathlib import Path

path = Path("scanner-access-qr.png")
qrcode.make("https://192.168.137.1:3000").save(path)
print(f"Generated scanner access QR code at: {path.resolve()}")
