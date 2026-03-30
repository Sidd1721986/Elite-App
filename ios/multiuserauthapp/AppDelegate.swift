import UIKit
import React
import React_RCTAppDelegate

@main
class AppDelegate: RCTAppDelegate {

  override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
#if DEBUG
    // Pin packager host before any bridge / inspector code runs. Must match `npm start` (--host 127.0.0.1).
#if targetEnvironment(simulator)
    RCTBundleURLProvider.sharedSettings().jsLocation = "127.0.0.1"
#else
    if let ipPath = Bundle.main.path(forResource: "ip", ofType: "txt"),
       let ip = try? String(contentsOfFile: ipPath, encoding: .utf8)
        .trimmingCharacters(in: .whitespacesAndNewlines),
       !ip.isEmpty {
      RCTBundleURLProvider.sharedSettings().jsLocation = ip
    }
#endif
#endif
    self.moduleName = "multiuserauthapp"
    self.initialProps = nil
    self.automaticallyLoadReactNativeWindow = true

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    return self.bundleURL()
  }

  /// Debug: load JS from Metro. Prefer RCTBundleURLProvider (respects jsLocation); never use bracketed IPv6
  /// URLs — RN 0.76’s inspector crashes on those.
  override func bundleURL() -> URL? {
#if DEBUG
#if targetEnvironment(simulator)
    let provider = RCTBundleURLProvider.sharedSettings()
    let resolved: URL? = {
      if let u = provider.jsBundleURL(forBundleRoot: "index") { return u }
      if let u = Self.metroBundleURL(host: "127.0.0.1") { return u }
      return Self.metroBundleURL(host: "localhost")
    }()
    // Debug session 5e5546: proves native layer URL (shows in Xcode console, not always in Metro).
    NSLog("[AGENT_DEBUG_NATIVE] bundleURL=%@ session=5e5546", resolved?.absoluteString ?? "nil")
    return resolved
#else
    let provider = RCTBundleURLProvider.sharedSettings()
    let resolved: URL? = {
      if let u = provider.jsBundleURL(forBundleRoot: "index") { return u }
      return Self.metroBundleURL(host: Self.metroHostForDevice())
    }()
    NSLog("[AGENT_DEBUG_NATIVE] bundleURL=%@ session=5e5546", resolved?.absoluteString ?? "nil")
    return resolved
#endif
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }

  private static func metroHostForDevice() -> String {
    if let ipPath = Bundle.main.path(forResource: "ip", ofType: "txt"),
       let ip = try? String(contentsOfFile: ipPath, encoding: .utf8)
        .trimmingCharacters(in: .whitespacesAndNewlines),
       !ip.isEmpty {
      return ip
    }
    return "127.0.0.1"
  }

  private static func metroBundleURL(host: String) -> URL? {
    let port = 8081

    var queryParts = URLComponents()
    queryParts.queryItems = [
      URLQueryItem(name: "platform", value: "ios"),
      URLQueryItem(name: "dev", value: "true"),
      URLQueryItem(name: "lazy", value: "true"),
      URLQueryItem(name: "minify", value: "false"),
      URLQueryItem(name: "inlineSourceMap", value: "false"),
      URLQueryItem(name: "modulesOnly", value: "false"),
      URLQueryItem(name: "runModule", value: "true"),
    ]
    if let bundleId = Bundle.main.bundleIdentifier {
      queryParts.queryItems?.append(URLQueryItem(name: "app", value: bundleId))
    }
    let encodedQuery = queryParts.percentEncodedQuery ?? ""

    if host.contains(":") {
      return URL(string: "http://[\(host)]:\(port)/index.bundle?\(encodedQuery)")
    }

    var components = URLComponents()
    components.scheme = "http"
    components.host = host
    components.port = port
    components.path = "/index.bundle"
    components.percentEncodedQuery = encodedQuery
    return components.url
  }
}
