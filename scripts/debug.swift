// Drives a running debug build (launched with QUIRE_DEBUG=1). See CLAUDE.md → "Verifying UI changes".
//   swift scripts/debug.swift js "location.hash='#/'"
//   swift scripts/debug.swift snapshot /absolute/path/out.png
import Foundation

let args = CommandLine.arguments
guard args.count == 3, ["js", "snapshot"].contains(args[1]) else {
    print("usage: debug.swift js <javascript> | snapshot <png path>")
    exit(1)
}
DistributedNotificationCenter.default().postNotificationName(
    .init("com.ravi.quire.debug." + args[1]), object: args[2], userInfo: nil, deliverImmediately: true)
