import AppKit
import WebKit

/// Development hooks, enabled only when QUIRE_DEBUG is set:
///   notifyutil-style distributed notifications let scripts drive the app and snapshot its window.
///   com.ravi.quire.debug.js       object = JavaScript to evaluate
///   com.ravi.quire.debug.snapshot object = output PNG path
enum DebugHooks {
    static func install(window: NSWindow, webView: WKWebView) {
        guard ProcessInfo.processInfo.environment["QUIRE_DEBUG"] != nil else { return }
        let center = DistributedNotificationCenter.default()
        center.addObserver(forName: .init("com.ravi.quire.debug.js"), object: nil, queue: .main) { note in
            if let js = note.object as? String { webView.evaluateJavaScript(js) }
        }
        // object = "x,y" in window points from the top-left; logs which view would receive a click there.
        center.addObserver(forName: .init("com.ravi.quire.debug.hittest"), object: nil, queue: .main) { note in
            guard let spec = note.object as? String, let frameView = window.contentView?.superview else { return }
            let nums = spec.split(separator: ",").compactMap { Double($0) }
            guard nums.count == 2 else { return }
            let p = NSPoint(x: nums[0], y: window.frame.height - nums[1])
            let hit = frameView.hitTest(frameView.convert(p, from: nil))
            print("[hit] \(spec) → \(hit.map { String(describing: type(of: $0)) } ?? "nil") canMoveWindow=\(hit?.mouseDownCanMoveWindow ?? false)")
            fflush(stdout)
        }
        // object = "width,height" in points; resizes the window (e.g. to simulate full screen).
        center.addObserver(forName: .init("com.ravi.quire.debug.frame"), object: nil, queue: .main) { note in
            let nums = (note.object as? String ?? "").split(separator: ",").compactMap { Double($0) }
            guard nums.count == 2 else { return }
            var f = window.frame
            f.origin.y += f.height - nums[1]
            f.size = NSSize(width: nums[0], height: nums[1])
            window.setFrame(f, display: true)
        }
        center.addObserver(forName: .init("com.ravi.quire.debug.snapshot"), object: nil, queue: .main) { note in
            guard let path = note.object as? String,
                  let image = CGWindowListCreateImage(.null, .optionIncludingWindow, CGWindowID(window.windowNumber), [.boundsIgnoreFraming])
            else { return }
            let rep = NSBitmapImageRep(cgImage: image)
            try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: path))
        }
    }
}
