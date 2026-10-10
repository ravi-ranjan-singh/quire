import AppKit
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var schemeHandler: SchemeHandler!
    private var vault: Vault?

    private static let vaultKey = "vaultPath"

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()

        let webRoot = ProcessInfo.processInfo.environment["QUIRE_WEB_DIR"].map { URL(fileURLWithPath: $0) }
            ?? Bundle.main.resourceURL!.appendingPathComponent("web")
        schemeHandler = SchemeHandler(webRoot: webRoot)

        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(schemeHandler, forURLScheme: SchemeHandler.scheme)
        config.userContentController.add(self, name: "quire")
        config.preferences.isElementFullscreenEnabled = true
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")

        webView = WKWebView(frame: .zero, configuration: config)
        webView.setValue(false, forKey: "drawsBackground")
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsMagnification = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        if #available(macOS 13.3, *) { webView.isInspectable = true }

        let background = NSVisualEffectView()
        background.material = .sidebar
        background.blendingMode = .behindWindow
        background.state = .followsWindowActiveState

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1320, height: 860),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered, defer: false)
        window.title = "Quire"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.titlebarSeparatorStyle = .none
        window.minSize = NSSize(width: 640, height: 480)
        window.contentView = background
        window.isReleasedWhenClosed = false
        window.tabbingMode = .disallowed

        let toolbar = NSToolbar(identifier: "main")
        toolbar.delegate = self
        toolbar.displayMode = .iconOnly
        toolbar.allowsUserCustomization = false
        window.toolbar = toolbar
        window.toolbarStyle = .unified

        webView.translatesAutoresizingMaskIntoConstraints = false
        background.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: background.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: background.trailingAnchor),
            webView.topAnchor.constraint(equalTo: background.topAnchor),
            webView.bottomAnchor.constraint(equalTo: background.bottomAnchor),
        ])

        window.setFrameAutosaveName("QuireMain")
        if !window.setFrameUsingName("QuireMain") { window.center() }

        openVault(at: initialVault(), reload: false)
        webView.load(URLRequest(url: SchemeHandler.home))
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        DebugHooks.install(window: window, webView: webView)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag { window.makeKeyAndOrderFront(nil) }
        return true
    }

    // MARK: Vault

    private func initialVault() -> URL? {
        if let override = ProcessInfo.processInfo.environment["QUIRE_VAULT"] { return URL(fileURLWithPath: override) }
        if let saved = UserDefaults.standard.string(forKey: Self.vaultKey), FileManager.default.fileExists(atPath: saved) {
            return URL(fileURLWithPath: saved)
        }
        return Vault.obsidianDefault()
    }

    private func openVault(at url: URL?, reload: Bool) {
        vault?.stopWatching()
        guard let url else {
            vault = nil
            schemeHandler.vault = nil
            return
        }
        let v = Vault(root: url)
        vault = v
        schemeHandler.vault = v
        if ProcessInfo.processInfo.environment["QUIRE_VAULT"] == nil {
            UserDefaults.standard.set(url.path, forKey: Self.vaultKey)
        }
        v.watch { [weak self] in
            self?.webView.evaluateJavaScript("window.quire && window.quire.vaultChanged()")
        }
        if reload { webView.load(URLRequest(url: SchemeHandler.home)) }
    }

    @objc func chooseVault(_ sender: Any?) {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.prompt = "Open Vault"
        panel.message = "Choose a folder of Markdown notes (e.g. your Obsidian vault)."
        if let current = vault?.root { panel.directoryURL = current }
        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let url = panel.url else { return }
            self?.openVault(at: url, reload: true)
        }
    }

    // MARK: Commands → web

    private func send(_ command: String) {
        webView.evaluateJavaScript("window.quire && window.quire.command('\(command)')")
    }

    @objc func quickOpen(_ sender: Any?) { send("quickOpen") }
    @objc func toggleLibrary(_ sender: Any?) { send("toggleSidebar") }
    @objc func toggleContents(_ sender: Any?) { send("toggleToc") }
    @objc func showAppearance(_ sender: Any?) { send("settings") }
    @objc func goBack(_ sender: Any?) { send("back") }
    @objc func goForward(_ sender: Any?) { send("forward") }
    @objc func goHome(_ sender: Any?) { send("home") }
    @objc func zoomIn(_ sender: Any?) { send("zoomIn") }
    @objc func zoomOut(_ sender: Any?) { send("zoomOut") }
    @objc func zoomReset(_ sender: Any?) { send("zoomReset") }
    @objc func reloadVault(_ sender: Any?) { send("reload") }
    @objc func setTheme(_ sender: NSMenuItem) { send("theme:\(sender.representedObject as? String ?? "auto")") }
    @objc func revealVault(_ sender: Any?) {
        if let root = vault?.root { NSWorkspace.shared.activateFileViewerSelecting([root]) }
    }

    // MARK: Menu

    private func buildMenu() {
        let main = NSMenu()

        func item(_ title: String, _ action: Selector?, _ key: String = "", _ mods: NSEvent.ModifierFlags = .command) -> NSMenuItem {
            let i = NSMenuItem(title: title, action: action, keyEquivalent: key)
            i.keyEquivalentModifierMask = mods
            return i
        }
        @discardableResult func submenu(_ title: String, _ items: [NSMenuItem]) -> NSMenuItem {
            let m = NSMenu(title: title)
            items.forEach(m.addItem)
            let i = NSMenuItem(title: title, action: nil, keyEquivalent: "")
            i.submenu = m
            main.addItem(i)
            return i
        }

        submenu("Quire", [
            item("About Quire", #selector(NSApplication.orderFrontStandardAboutPanel(_:))),
            .separator(),
            item("Appearance…", #selector(showAppearance(_:)), ","),
            .separator(),
            item("Hide Quire", #selector(NSApplication.hide(_:)), "h"),
            item("Hide Others", #selector(NSApplication.hideOtherApplications(_:)), "h", [.command, .option]),
            item("Show All", #selector(NSApplication.unhideAllApplications(_:))),
            .separator(),
            item("Quit Quire", #selector(NSApplication.terminate(_:)), "q"),
        ])
        submenu("File", [
            item("Open Note…", #selector(quickOpen(_:)), "k"),
            item("Open Vault…", #selector(chooseVault(_:)), "o", [.command, .shift]),
            item("Show Vault in Finder", #selector(revealVault(_:))),
            item("Reload Vault", #selector(reloadVault(_:)), "r"),
            .separator(),
            item("Close Window", #selector(NSWindow.performClose(_:)), "w"),
        ])
        submenu("Edit", [
            item("Copy", #selector(NSText.copy(_:)), "c"),
            item("Select All", #selector(NSText.selectAll(_:)), "a"),
        ])

        let themes = [("Match System", "auto"), ("Paper", "paper"), ("Sepia", "sepia"), ("Night", "night")].map { title, id -> NSMenuItem in
            let i = item(title, #selector(setTheme(_:)))
            i.representedObject = id
            return i
        }
        let themeItem = NSMenuItem(title: "Theme", action: nil, keyEquivalent: "")
        themeItem.submenu = NSMenu(title: "Theme")
        themes.forEach(themeItem.submenu!.addItem)

        submenu("View", [
            item("Toggle Library", #selector(toggleLibrary(_:)), "s", [.command, .control]),
            item("Toggle Contents", #selector(toggleContents(_:)), "."),
            .separator(),
            item("Larger Text", #selector(zoomIn(_:)), "+"),
            item("Smaller Text", #selector(zoomOut(_:)), "-"),
            item("Actual Size", #selector(zoomReset(_:)), "0"),
            .separator(),
            themeItem,
            .separator(),
            item("Enter Full Screen", #selector(NSWindow.toggleFullScreen(_:)), "f", [.command, .control]),
        ])
        submenu("Go", [
            item("Back", #selector(goBack(_:)), "["),
            item("Forward", #selector(goForward(_:)), "]"),
            item("Home", #selector(goHome(_:)), "h", [.command, .shift]),
        ])
        let windowMenu = submenu("Window", [
            item("Minimize", #selector(NSWindow.performMiniaturize(_:)), "m"),
            item("Zoom", #selector(NSWindow.performZoom(_:))),
        ])
        NSApp.windowsMenu = windowMenu.submenu
        NSApp.mainMenu = main
    }
}

// MARK: - Toolbar

extension NSToolbarItem.Identifier {
    static let library = Self("library")
    static let back = Self("back")
    static let forward = Self("forward")
    static let search = Self("search")
    static let contents = Self("contents")
    static let appearance = Self("appearance")
}

extension AppDelegate: NSToolbarDelegate {
    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [.library, .back, .forward, .flexibleSpace, .search, .contents, .appearance]
    }

    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        toolbarDefaultItemIdentifiers(toolbar)
    }

    func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier id: NSToolbarItem.Identifier, willBeInsertedIntoToolbar flag: Bool) -> NSToolbarItem? {
        let spec: [NSToolbarItem.Identifier: (String, String, Selector)] = [
            .library: ("sidebar.left", "Library", #selector(toggleLibrary(_:))),
            .back: ("chevron.left", "Back", #selector(goBack(_:))),
            .forward: ("chevron.right", "Forward", #selector(goForward(_:))),
            .search: ("magnifyingglass", "Search", #selector(quickOpen(_:))),
            .contents: ("list.bullet.indent", "Contents", #selector(toggleContents(_:))),
            .appearance: ("textformat.size", "Appearance", #selector(showAppearance(_:))),
        ]
        guard let (symbol, label, action) = spec[id] else { return nil }
        let item = NSToolbarItem(itemIdentifier: id)
        item.image = NSImage(systemSymbolName: symbol, accessibilityDescription: label)
        item.label = label
        item.toolTip = label
        item.target = self
        item.action = action
        item.isBordered = true
        return item
    }
}

// MARK: - Web bridge

extension AppDelegate: WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        switch action {
        case "openExternal":
            if let s = body["url"] as? String, let url = URL(string: s) { NSWorkspace.shared.open(url) }
        case "copy":
            if let text = body["text"] as? String {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(text, forType: .string)
            }
        case "openInObsidian":
            guard let path = body["path"] as? String, let vault else { return }
            var c = URLComponents()
            c.scheme = "obsidian"
            c.host = "open"
            c.queryItems = [URLQueryItem(name: "vault", value: vault.name), URLQueryItem(name: "file", value: path)]
            if let url = c.url { NSWorkspace.shared.open(url) }
        case "chooseVault":
            chooseVault(nil)
        case "title":
            window.title = body["title"] as? String ?? "Quire"
        case "appearance":
            switch body["mode"] as? String {
            case "dark": NSApp.appearance = NSAppearance(named: .darkAqua)
            case "light": NSApp.appearance = NSAppearance(named: .aqua)
            default: NSApp.appearance = nil
            }
        default:
            break
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        if url.scheme == SchemeHandler.scheme || url.scheme == "about" {
            decisionHandler(.allow)
        } else {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
