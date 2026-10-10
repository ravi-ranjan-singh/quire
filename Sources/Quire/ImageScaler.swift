import Foundation
import ImageIO
import UniformTypeIdentifiers

/// Downscales oversized vault images before they reach WebKit, so the web process never decodes
/// a 6000px screenshot to show it at 1000pt. Results are cached on disk (not in memory).
enum ImageScaler {
    /// Upper bound when the page doesn't say how wide the image will be shown.
    static let maxPixelSize = 2400

    private static let cacheDir: URL = {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("com.ravi.quire/images", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    static func isScalable(_ url: URL) -> Bool {
        ["png", "jpg", "jpeg", "heic", "webp", "bmp", "tiff", "gif"].contains(url.pathExtension.lowercased())
            && url.pathExtension.lowercased() != "gif" // keep animations intact
    }

    /// Returns (data, mime) for the image at `url`, scaled down if it is larger than `maxPixelSize`.
    static func data(for url: URL, width requested: Int?) throws -> (Data, String)? {
        let maxPixelSize = min(requested ?? Self.maxPixelSize, Self.maxPixelSize)
        guard isScalable(url) else { return nil }
        let attrs = try FileManager.default.attributesOfItem(atPath: url.path)
        let mtime = (attrs[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
        let size = (attrs[.size] as? NSNumber)?.intValue ?? 0
        let key = "\(url.path)|\(mtime)|\(size)|\(maxPixelSize)".hashValueStable
        let cached = cacheDir.appendingPathComponent(key + ".png")
        if let data = try? Data(contentsOf: cached) { return (data, "image/png") }

        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let w = props[kCGImagePropertyPixelWidth] as? Int, let h = props[kCGImagePropertyPixelHeight] as? Int,
              w > maxPixelSize
        else { return nil }

        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            // Thumbnail size applies to the longer edge; convert the width limit accordingly.
            kCGImageSourceThumbnailMaxPixelSize: max(w, h) * maxPixelSize / w,
            kCGImageSourceShouldCacheImmediately: false,
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        let out = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(out, UTType.png.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(dest, image, nil)
        guard CGImageDestinationFinalize(dest) else { return nil }
        try? (out as Data).write(to: cached, options: .atomic)
        return (out as Data, "image/png")
    }
}

private extension String {
    /// FNV-1a — stable across launches, unlike `hashValue`.
    var hashValueStable: String {
        var hash: UInt64 = 0xcbf29ce484222325
        for byte in utf8 { hash = (hash ^ UInt64(byte)) &* 0x100000001b3 }
        return String(hash, radix: 16)
    }
}
