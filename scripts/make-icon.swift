// Renders the Quire app icon (1024×1024 PNG). Usage: swift scripts/make-icon.swift out.png
import AppKit

let size: CGFloat = 1024
let image = NSImage(size: NSSize(width: size, height: size))
image.lockFocus()
let ctx = NSGraphicsContext.current!.cgContext

func color(_ hex: UInt32, _ a: CGFloat = 1) -> NSColor {
    NSColor(srgbRed: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: a)
}

// Squircle body with a drop shadow.
let body = NSRect(x: 100, y: 100, width: 824, height: 824)
let squircle = NSBezierPath(roundedRect: body, xRadius: 186, yRadius: 186)
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -10), blur: 28, color: NSColor.black.withAlphaComponent(0.28).cgColor)
color(0xC4562E).setFill()
squircle.fill()
ctx.restoreGState()
NSGradient(colors: [color(0xE07C50), color(0xB44821)], atLocations: [0, 1], colorSpace: .sRGB)!
    .draw(in: squircle, angle: -90)
// Soft top highlight.
NSGradient(colors: [NSColor.white.withAlphaComponent(0.18), NSColor.white.withAlphaComponent(0)])!
    .draw(in: NSBezierPath(roundedRect: body, xRadius: 186, yRadius: 186), angle: -90)

// The page.
ctx.saveGState()
ctx.translateBy(x: 512, y: 500)
ctx.rotate(by: -0.06)
let page = NSRect(x: -230, y: -290, width: 460, height: 590)
let pagePath = NSBezierPath(roundedRect: page, xRadius: 34, yRadius: 34)
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -18), blur: 40, color: NSColor.black.withAlphaComponent(0.3).cgColor)
color(0xFDFAF4).setFill()
pagePath.fill()
ctx.restoreGState()

// Heading + text lines.
color(0x2A2420).setFill()
NSBezierPath(roundedRect: NSRect(x: -170, y: 180, width: 250, height: 34), xRadius: 17, yRadius: 17).fill()
let widths: [CGFloat] = [340, 320, 340, 210, 0, 340, 300, 250]
var y: CGFloat = 100
for w in widths {
    if w > 0 {
        color(0xB9AE9F).setFill()
        NSBezierPath(roundedRect: NSRect(x: -170, y: y, width: w, height: 18), xRadius: 9, yRadius: 9).fill()
    }
    y -= 46
}
// Highlighted line.
color(0xF5C451, 0.85).setFill()
NSBezierPath(roundedRect: NSRect(x: -178, y: 100 - 46 * 2 - 9, width: 220, height: 36), xRadius: 8, yRadius: 8).fill()
color(0x8A7B66).setFill()
NSBezierPath(roundedRect: NSRect(x: -170, y: 100 - 46 * 2, width: 200, height: 18), xRadius: 9, yRadius: 9).fill()

// Bookmark ribbon.
let ribbon = NSBezierPath()
ribbon.move(to: NSPoint(x: 120, y: 300))
ribbon.line(to: NSPoint(x: 120, y: 150))
ribbon.line(to: NSPoint(x: 150, y: 176))
ribbon.line(to: NSPoint(x: 180, y: 150))
ribbon.line(to: NSPoint(x: 180, y: 300))
ribbon.close()
color(0xC4562E).setFill()
ribbon.fill()
ctx.restoreGState()

image.unlockFocus()
let rep = NSBitmapImageRep(data: image.tiffRepresentation!)!
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
