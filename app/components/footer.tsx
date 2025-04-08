const Footer = () => {
    return (
        <footer className="py-4 min-h-96  ">
            <div className="container mx-auto text-center mt-40">
                <h1 className="text-4xl font-bold">Svelta</h1>

                <div className=" mt-4 ">
                    <h3 className="italic text-xs">Norrønt verb (intransitiv):</h3>
                    <h3 className="font-bold">Å lide av mangel på mat</h3>
                </div>


                <div className="mt-10">
                <a
                    href="https://eliastrana.no"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-gray-400 transition duration-300"
                >
                    Elias Trana
                </a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
