import Link from "next/link";

const Footer = () => {
    return (
        <footer className="relative overflow-hidden bg-[#171713] text-[#deded0] px-6 pt-24 pb-40">
            {/* Decorative background text */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="select-none text-[24vw] font-black uppercase tracking-tighter text-[#deded0]/5">
          Svelta
        </span>
            </div>

            {/* Subtle grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(222,222,208,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(222,222,208,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />

            <div className="relative z-10 mx-auto flex min-h-80 max-w-6xl flex-col justify-between gap-16">
                <div className="flex flex-col items-center text-center">
                    <p className="mb-4  px-4 py-1 text-xs uppercase  text-[#deded0]/60">
                        Norrønt verb:
                    </p>

                    <h1 className="text-6xl font-black tracking-tighter sm:text-8xl">
                        Svelta
                    </h1>

                    <div className="mt-6 max-w-md">
                        <p className="italic text-[#deded0]/60">
                            intransitiv
                        </p>
                        <p className="mt-2 text-xl font-semibold sm:text-2xl">
                            Å lide av mangel på mat
                        </p>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-between gap-8 border-t border-[#deded0]/15 pt-8 text-sm sm:flex-row">
                    <p className="text-[#deded0]/45">
                        © {new Date().getFullYear()} Svelta
                    </p>

                    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
                        <Link
                            href="/vilkar"
                            className="group relative uppercase tracking-widest text-[#deded0]/70 transition hover:text-[#deded0]"
                        >
                            Vilkår
                            <span className="absolute -bottom-1 left-0 h-px w-0 bg-[#deded0] transition-all duration-300 group-hover:w-full" />
                        </Link>

                        <a
                            href="https://eliastrana.no"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative uppercase tracking-widest text-[#deded0]/70 transition hover:text-[#deded0]"
                        >
                            Elias Trana
                            <span className="absolute -bottom-1 left-0 h-px w-0 bg-[#deded0] transition-all duration-300 group-hover:w-full" />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;