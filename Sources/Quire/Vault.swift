import Foundation

/// Reads the vault from disk and watches it for changes.
final class Vault {
    let root: URL
    private var stream: FSEventStreamRef?
    private var onChange: (() -> Void)?
    private var debounce: DispatchWorkItem?

    init(root: URL) {
        self.root = root.standardizedFileURL
    }

    deinit { stopWatching() }

    var name: String { root.lastPathComponent }

    /// The JSON payload the web UI expects at `api/vault`.
    func payload() throws -> Data {
        var notes: [[String: Any]] = []
        var files: [String] = []
        let keys: [URLResourceKey] = [.isDirectoryKey, .contentModificationDateKey]
        guard let walker = FileManager.default.enumerator(
            at: root, includingPropertiesForKeys: keys, options: [.skipsHiddenFiles, .skipsPackageDescendants]
        ) else {
            throw NSError(domain: "Quire", code: 1, userInfo: [NSLocalizedDescriptionKey: "Can't read \(root.path)"])
        }
        let rootPath = root.path.hasSuffix("/") ? root.path : root.path + "/"
        for case let url as URL in walker {
            let values = try? url.resourceValues(forKeys: Set(keys))
            if values?.isDirectory == true { continue }
            let rel = String(url.standardizedFileURL.path.dropFirst(rootPath.count))
            if url.pathExtension.lowercased() == "md" {
                guard let text = try? String(contentsOf: url, encoding: .utf8) else { continue }
                let mtime = (values?.contentModificationDate ?? Date()).timeIntervalSince1970 * 1000
                notes.append(["path": rel, "mtime": mtime, "content": text])
            } else {
                files.append(rel)
            }
        }
        let body: [String: Any] = ["name": name, "root": root.path, "notes": notes, "files": files]
        return try JSONSerialization.data(withJSONObject: body)
    }

    /// Resolve a vault-relative path, refusing anything that escapes the vault.
    func file(at relative: String) -> URL? {
        let url = root.appendingPathComponent(relative).standardizedFileURL
        guard url.path.hasPrefix(root.path + "/") else { return nil }
        return url
    }

    func watch(_ handler: @escaping () -> Void) {
        onChange = handler
        var context = FSEventStreamContext(
            version: 0, info: Unmanaged.passUnretained(self).toOpaque(), retain: nil, release: nil, copyDescription: nil)
        let callback: FSEventStreamCallback = { _, info, count, paths, _, _ in
            guard let info else { return }
            let vault = Unmanaged<Vault>.fromOpaque(info).takeUnretainedValue()
            let list = unsafeBitCast(paths, to: NSArray.self) as? [String] ?? []
            // Ignore Obsidian's own bookkeeping (workspace.json changes on every click).
            let relevant = list.prefix(count).contains { !$0.contains("/.obsidian/") && !$0.contains("/.git/") && !$0.contains("/.trash/") }
            if relevant { vault.scheduleChange() }
        }
        stream = FSEventStreamCreate(
            nil, callback, &context, [root.path] as CFArray,
            FSEventStreamEventId(kFSEventStreamEventIdSinceNow), 0.25,
            UInt32(kFSEventStreamCreateFlagUseCFTypes | kFSEventStreamCreateFlagFileEvents))
        if let stream {
            FSEventStreamSetDispatchQueue(stream, .main)
            FSEventStreamStart(stream)
        }
    }

    func stopWatching() {
        guard let stream else { return }
        FSEventStreamStop(stream)
        FSEventStreamInvalidate(stream)
        FSEventStreamRelease(stream)
        self.stream = nil
    }

    private func scheduleChange() {
        debounce?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.onChange?() }
        debounce = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3, execute: work)
    }

    /// The vault Obsidian last had open, if any.
    static func obsidianDefault() -> URL? {
        let config = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/obsidian/obsidian.json")
        guard let data = try? Data(contentsOf: config),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let vaults = json["vaults"] as? [String: [String: Any]] else { return nil }
        let sorted = vaults.values.sorted {
            (($0["open"] as? Bool) == true ? 1 : 0, $0["ts"] as? Double ?? 0) > (($1["open"] as? Bool) == true ? 1 : 0, $1["ts"] as? Double ?? 0)
        }
        for v in sorted {
            if let path = v["path"] as? String, FileManager.default.fileExists(atPath: path) {
                return URL(fileURLWithPath: path)
            }
        }
        return nil
    }
}
