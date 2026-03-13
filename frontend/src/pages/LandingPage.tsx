import { Link } from "react-router-dom";

export function LandingPage() {
  const features = [
    {
      icon: "⚡",
      title: "Monaco Editor",
      description:
        "VS Code's editor engine - syntax highlighting, IntelliSense, and multi-language support out of the box.",
      badge: "@monaco-editor/react",
    },
    {
      icon: "🔄",
      title: "Yjs CRDT Sync",
      description:
        "Mathematically conflict-free real-time sync. Two people typing simultaneously always converge - guaranteed.",
      badge: "y-websocket + y-monaco",
    },
    {
      icon: "▶️",
      title: "Judge0 Execution",
      description:
        "Run Python, JavaScript, C++, Java and 60+ more languages securely in isolated sandboxes.",
      badge: "Judge0 API",
    },
    {
      icon: "🟣",
      title: "Live Presence",
      description:
        "See teammates' cursors, selections, and avatars in real time. Know exactly who is editing what.",
      badge: "Yjs Awareness",
    },
    {
      icon: "📁",
      title: "Project File Tree",
      description:
        "Full folder and file management per project. Create, rename, delete - all synced across collaborators instantly.",
      badge: "MongoDB + REST API",
    },
    {
      icon: "🔐",
      title: "Auth + Roles",
      description:
        "Secure JWT auth with per-project roles - Viewer, Editor, and Admin. Invite teammates by email.",
      badge: "JWT + bcrypt",
    },
  ];

  return (
    <main className="min-h-screen bg-[#111315] text-vscode-text">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between border-b border-vscode-border px-5 py-5">
        <div className="flex items-center gap-2 text-xl font-semibold text-white md:text-2xl">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#29b6f6]" />
          <span>Colab Code</span>
        </div>

        <nav className="hidden items-center gap-8 text-base text-vscode-muted md:flex">
          <a className="transition hover:text-white" href="#features">
            Features
          </a>
          <a className="transition hover:text-white" href="#docs">
            Docs
          </a>
          <a className="transition hover:text-white" href="#pricing">
            Pricing
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link className="text-base text-vscode-muted hover:text-white" to="/login">
            Sign In
          </Link>
          <Link
            className="rounded-2xl border border-[#4a4a4a] px-5 py-2 text-base font-semibold text-white hover:border-[#636363] hover:bg-[#1c1c1c]"
            to="/register"
          >
            Get Started →
          </Link>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-5 py-14 lg:grid-cols-[1.03fr_0.97fr]">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold tracking-[0.14em] text-[#2aa7ea]">REAL-TIME COLLABORATIVE IDE</p>
          <h1 className="text-5xl font-bold leading-[1.08] text-white md:text-6xl lg:text-7xl">
            Code together,
            <br />
            <span className="text-[#29b6f6]">live and in sync.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-[1.5] text-[#b8b8b8] md:text-xl">
            Colab Code is a browser-based IDE where teams write, run, and debug code simultaneously - with VS Code
            fidelity, zero setup, and no merge conflicts.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              className="rounded-2xl border border-[#3a3a3a] bg-[#1b1b1b] px-6 py-3 text-lg font-semibold text-white hover:bg-[#262626]"
              to="/dashboard"
            >
              Open Dashboard →
            </Link>
            <Link
              className="rounded-2xl border border-[#3a3a3a] bg-transparent px-6 py-3 text-lg font-semibold text-white hover:bg-[#1d1d1d]"
              to="/project/colab-code"
            >
              Preview Editor
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-vscode-border bg-[#1b1d1f] shadow-2xl">
          <div className="flex items-center justify-between rounded-t-2xl border-b border-vscode-border bg-[#232529] px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ff605c]" />
              <span className="h-3 w-3 rounded-full bg-[#ffbd44]" />
              <span className="h-3 w-3 rounded-full bg-[#00ca4e]" />
            </div>
            <div className="flex items-center text-[14px] font-semibold text-[#b8b8b8]">
              <span className="border-b-2 border-[#4fc1ff] px-4 py-1 text-white">main.py</span>
              <span className="px-4 py-1">utils.js</span>
            </div>
            <div />
          </div>

          <div className="relative bg-[#1e1e1e] px-5 py-4 font-mono text-[15px] leading-7 text-[#d4d4d4]">
            <pre className="whitespace-pre-wrap">
              <span className="text-[#6a9955]"># Colab Code - live session</span>
              {"\n\n"}
              <span className="text-[#569cd6]">def</span> greet(name):
              {"\n  "}
              <span className="text-[#c586c0]">return</span> <span className="text-[#ce9178]">f"Hello, {"{name}"}!"</span>
              {"\n\n"}
              <span className="text-[#569cd6]">def</span> main():
              {"\n  "}users = [<span className="text-[#ce9178]">"Aadi"</span>, <span className="text-[#ce9178]">"Harsh"</span>]
              {"\n  "}
              <span className="text-[#569cd6]">for</span> u <span className="text-[#569cd6]">in</span> users:
              {"\n    "}print(greet(u))
              {"\n\n"}
              main()
            </pre>
            <span className="blink-cursor absolute left-[52%] top-[51%] h-5 w-[2px] bg-[#f44747]" />
            <span className="blink-cursor-delayed absolute left-[67%] top-[61%] h-5 w-[2px] bg-[#4ec9b0]" />
          </div>

          <div className="flex items-center gap-3 rounded-b-2xl border-t border-vscode-border bg-[#1f1f1f] px-4 py-3 text-sm text-[#b3b3b3]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f44747] text-xs font-bold text-white">
              A
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4ec9b0] text-xs font-bold text-white">
              H
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#dcdcaa] text-xs font-bold text-[#111]">
              K
            </span>
            <span>3 collaborators editing · live</span>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl border-t border-vscode-border px-5 py-12" id="features">
        <h2 className="text-3xl font-bold text-white md:text-4xl">Everything a modern team needs</h2>
        <p className="mt-1 text-lg text-[#b8b8b8] md:text-xl">
          Built on the same tech that powers production IDEs and collaboration tools.
        </p>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="flex min-h-[210px] flex-col rounded-2xl border border-vscode-border bg-[#1a1c1f] p-5"
            >
              <span className="text-2xl">{feature.icon}</span>
              <h3 className="mt-3 text-2xl font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-base leading-[1.5] text-[#b8b8b8]">{feature.description}</p>
              <span className="mt-auto inline-block w-fit rounded-md bg-[#10345d] px-3 py-1 text-xs font-medium text-[#79c0ff]">
                {feature.badge}
              </span>
            </article>
          ))}
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-5 pb-16 text-sm text-vscode-muted" id="docs">
        <div className="rounded-xl border border-vscode-border bg-[#17191c] px-4 py-3" id="pricing">
          Docs and pricing pages are coming next.
          <Link className="ml-2 text-[#4fc1ff] hover:underline" to="/dashboard">
            Continue to app
          </Link>
          .
        </div>
      </div>
    </main>
  );
}
