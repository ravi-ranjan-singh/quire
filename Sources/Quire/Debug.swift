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
        center.addObserver(forName: .init("com.ravi.quire.debug.snapshot"), object: nil, queue: .main) { note in
            guard let path = note.object as? String,
                  let image = CGWindowListCreateImage(.null, .optionIncludingWindow, CGWindowID(window.windowNumber), [.boundsIgnoreFraming])
            else { return }
            let rep = NSBitmapImageRep(cgImage: image)
            try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: path))
        }
    }
}
