// Drives a running debug build (launched with QUIRE_DEBUG=1). See CLAUDE.md → "Verifying UI changes".
//   swift scripts/debug.swift js "location.hash='#/'"
//   swift scripts/debug.swift snapshot /absolute/path/out.png
//   swift scripts/debug.swift hittest 600,20      (window points from top-left; prints the view under it)
//   swift scripts/debug.swift frame 1728,1080   (resize the window, e.g. to a full-screen size)
import Foundation

let args = CommandLine.arguments
guard args.count == 3, ["js", "snapshot", "hittest", "frame"].contains(args[1]) else {
    print("usage: debug.swift js <javascript> | snapshot <png path> | hittest <x,y> | frame <w,h>")
    exit(1)
}
DistributedNotificationCenter.default().postNotificationName(
    .init("com.ravi.quire.debug." + args[1]), object: args[2], userInfo: nil, deliverImmediately: true)
