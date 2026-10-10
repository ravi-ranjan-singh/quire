import AppKit

/// Transparent strip over the top of the window that moves the window when dragged.
/// The web view fills the whole window (fullSizeContentView), so without this the titlebar area
/// would swallow drags. Toolbar items live in the titlebar container above this view and stay clickable.
final class DragStrip: NSView {
    weak var scrollTarget: NSView?

    override var mouseDownCanMoveWindow: Bool { true }

    override func mouseDown(with event: NSEvent) {
        if event.clickCount == 2 {
            let action = UserDefaults.standard.string(forKey: "AppleActionOnDoubleClick") ?? "Maximize"
            if action == "Minimize" { window?.miniaturize(nil) } else if action != "None" { window?.zoom(nil) }
            return
        }
        window?.performDrag(with: event)
    }

    override func scrollWheel(with event: NSEvent) {
        scrollTarget?.scrollWheel(with: event)
    }
}
