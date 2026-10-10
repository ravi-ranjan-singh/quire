import Foundation
import UniformTypeIdentifiers
import WebKit

/// Serves `quire://app/...`: the bundled web UI, the vault API and raw vault files.
final class SchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "quire"
    static let home = URL(string: "quire://app/index.html")!

    let webRoot: URL
    var vault: Vault?
    private var active = Set<ObjectIdentifier>()
    private let queue = DispatchQueue(label: "quire.scheme", qos: .userInitiated)

    init(webRoot: URL) {
        self.webRoot = webRoot
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        let id = ObjectIdentifier(task)
        active.insert(id)
        let path = task.request.url?.path.removingPercentEncoding ?? "/"
        let width = task.request.url.flatMap { URLComponents(url: $0, resolvingAgainstBaseURL: false) }?
            .queryItems?.first { $0.name == "w" }?.value.flatMap(Int.init)
        let vault = self.vault
        let webRoot = self.webRoot

        queue.async {
            let result: Result<(Data, String), Error>
            do {
                if path == "/api/vault" {
                    guard let vault else { throw Self.error("No vault selected") }
                    result = .success((try vault.payload(), "application/json"))
                } else if path.hasPrefix("/vault/") {
                    guard let vault, let url = vault.file(at: String(path.dropFirst(7))) else { throw Self.error("Not found") }
                    if let scaled = try? ImageScaler.data(for: url, width: width) {
                        result = .success(scaled)
                    } else {
                        result = .success((try Data(contentsOf: url, options: .mappedIfSafe), Self.mime(for: url)))
                    }
                } else {
                    let rel = path == "/" ? "index.html" : String(path.dropFirst())
                    let url = webRoot.appendingPathComponent(rel).standardizedFileURL
                    guard url.path.hasPrefix(webRoot.standardizedFileURL.path) else { throw Self.error("Not found") }
                    result = .success((try Data(contentsOf: url), Self.mime(for: url)))
                }
            } catch {
                result = .failure(error)
            }

            DispatchQueue.main.async {
                guard self.active.remove(id) != nil, let url = task.request.url else { return }
                switch result {
                case .success(let (data, mime)):
                    let headers = [
                        "Content-Type": mime,
                        "Content-Length": String(data.count),
                        "Cache-Control": "no-store",
                    ]
                    let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!
                    task.didReceive(response)
                    task.didReceive(data)
                    task.didFinish()
                case .failure(let error):
                    let body = Data(error.localizedDescription.utf8)
                    let response = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "text/plain"])!
                    task.didReceive(response)
                    task.didReceive(body)
                    task.didFinish()
                }
            }
        }
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        active.remove(ObjectIdentifier(task))
    }

    private static func error(_ message: String) -> NSError {
        NSError(domain: "Quire", code: 404, userInfo: [NSLocalizedDescriptionKey: message])
    }

    private static func mime(for url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json"
        default: return UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        }
    }
}
