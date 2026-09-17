// scripts/brand/render-svg.swift
//
// Rasterizes an SVG to a square PNG using AppKit's built-in SVG support, so
// the brand-asset build needs no extra npm or Homebrew dependency. macOS only.
//
//   swift render-svg.swift <in.svg> <out.png> <pixels> [opaque]
//
// Pass "opaque" for images that must not carry an alpha channel -- App Store
// Connect rejects a 1024px app icon that has one, even if every pixel is solid.

import AppKit
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count >= 4, let px = Int(args[3]) else {
  FileHandle.standardError.write("usage: render-svg.swift <in.svg> <out.png> <pixels> [opaque]\n".data(using: .utf8)!)
  exit(1)
}
let opaque = args.count > 4 && args[4] == "opaque"

guard let image = NSImage(contentsOf: URL(fileURLWithPath: args[1])) else {
  FileHandle.standardError.write("could not load \(args[1])\n".data(using: .utf8)!)
  exit(1)
}

let alphaInfo: CGImageAlphaInfo = opaque ? .noneSkipLast : .premultipliedLast
guard let ctx = CGContext(
  data: nil, width: px, height: px, bitsPerComponent: 8, bytesPerRow: 0,
  space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: alphaInfo.rawValue
) else { exit(1) }

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: false)
image.draw(in: NSRect(x: 0, y: 0, width: px, height: px))
NSGraphicsContext.restoreGraphicsState()

guard let cgImage = ctx.makeImage(),
      let dest = CGImageDestinationCreateWithURL(
        URL(fileURLWithPath: args[2]) as CFURL, UTType.png.identifier as CFString, 1, nil)
else { exit(1) }
CGImageDestinationAddImage(dest, cgImage, nil)
guard CGImageDestinationFinalize(dest) else { exit(1) }
