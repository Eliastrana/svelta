import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Vilkår og betingelser | Svelta',
    description: 'Vilkår og betingelser for bruk av Svelta.',
};

const sections = [
    {
        title: '1. Om tjenesten',
        body: [
            'Svelta er en sosial oppskriftsapp hvor brukere kan publisere oppskrifter, lagre oppskrifter i kokebøker, følge andre brukere, like, kommentere og vurdere innhold.',
            'Ved å bruke Svelta godtar du disse vilkårene. Hvis du ikke godtar vilkårene, skal du ikke bruke tjenesten.',
        ],
    },
    {
        title: '2. Hvem kan bruke Svelta',
        body: [
            'Du er ansvarlig for at opplysningene du oppgir om deg selv er riktige, og for at kontoen din brukes på en trygg måte.',
            'Du må ikke gi andre tilgang til kontoen din på en måte som kan føre til misbruk eller uautorisert aktivitet.',
        ],
    },
    {
        title: '3. Hva du kan publisere',
        body: [
            'Du kan publisere oppskrifter, bilder, beskrivelser, kommentarer og annet innhold som er relevant for mat, matlaging og bruk av tjenesten.',
            'Du må bare publisere innhold du har rett til å bruke. Det betyr blant annet at du ikke skal laste opp bilder, tekst eller annet materiale som krenker andres rettigheter.',
        ],
    },
    {
        title: '4. Hva som ikke er tillatt',
        body: [
            'Det er ikke tillatt å publisere ulovlig, krenkende, villedende, truende, diskriminerende eller på annen måte skadelig innhold.',
            'Det er heller ikke tillatt å misbruke tjenesten teknisk, forsøke å få uautorisert tilgang, manipulere aktivitet som likes og vurderinger, eller bruke tjenesten til spam.',
        ],
    },
    {
        title: '5. Ditt ansvar for innhold',
        body: [
            'Du er selv ansvarlig for det du publiserer i Svelta.',
            'Hvis du deler oppskrifter, bilder eller annet materiale, beholder du i utgangspunktet rettighetene til innholdet ditt, men du gir Svelta en nødvendig bruksrett til å vise, lagre og distribuere innholdet i appen så lenge det finnes i tjenesten.',
        ],
    },
    {
        title: '6. Kokebøker, likes, kommentarer og vurderinger',
        body: [
            'Svelta lar deg opprette private og offentlige kokebøker. Offentlige kokebøker kan vises på profilsiden din og være tilgjengelige for andre brukere.',
            'Likes, kommentarer, vurderinger og andre handlinger i appen regnes som aktivitet knyttet til kontoen din og kan brukes for å vise innhold, telle aktivitet og skape sosiale funksjoner i tjenesten.',
        ],
    },
    {
        title: '7. Moderering og fjerning av innhold',
        body: [
            'Svelta kan fjerne innhold eller begrense tilgang til kontoer dersom det er nødvendig for å håndheve disse vilkårene, beskytte andre brukere, sikre stabil drift eller oppfylle rettslige plikter.',
            'Vi kan også gjøre endringer i innhold eller funksjonalitet dersom det er nødvendig for sikkerhet, feilretting eller videreutvikling av tjenesten.',
        ],
    },
    {
        title: '8. Personopplysninger og personvern',
        body: [
            'Svelta behandler personopplysninger som er nødvendige for å levere tjenesten, for eksempel profilinformasjon, bilder du laster opp, relasjoner mellom brukere og aktivitet i appen.',
            'Vi forsøker å gi tydelig informasjon om hvordan opplysninger brukes, og om hvilke valg du har som bruker. Rettigheter som innsyn, retting og sletting følger av personvernregelverket så langt det passer for tjenesten.',
        ],
    },
    {
        title: '9. Sletting av konto og aktivitet',
        body: [
            'Du kan be om å slette kontoen din fra rediger-profil-seksjonen i appen.',
            'Når en konto slettes, forsøker Svelta også å fjerne tilknyttet aktivitet fra tjenesten, inkludert egen profil, egne oppskrifter, egne kokebøker og aktivitet som likes, kommentarer og vurderinger. Enkelte opplysninger kan likevel måtte beholdes dersom det følger av lovkrav, sikkerhetshensyn eller tekniske begrensninger.',
        ],
    },
    {
        title: '10. Tilgjengelighet og endringer',
        body: [
            'Svelta leveres som den er. Vi garanterer ikke at tjenesten alltid er feilfri, kontinuerlig tilgjengelig eller fri for avbrudd.',
            'Vi kan når som helst oppdatere, endre eller avslutte deler av tjenesten dersom det er nødvendig.',
        ],
    },
    {
        title: '11. Ansvarsbegrensning',
        body: [
            'Svelta er ikke ansvarlig for innhold som brukere publiserer, med mindre ansvar følger av ufravikelig lov.',
            'Vi er heller ikke ansvarlige for indirekte tap, følgeskader eller tap som oppstår som følge av bruk eller manglende tilgang til tjenesten, med mindre annet følger av ufravikelig lov.',
        ],
    },
    {
        title: '12. Endringer i vilkårene',
        body: [
            'Disse vilkårene kan oppdateres over tid. Den versjonen som til enhver tid ligger publisert i appen, er den gjeldende versjonen.',
            'Hvis endringene er vesentlige, bør de kommuniseres tydelig i tjenesten.',
        ],
    },
    {
        title: '13. Kontakt',
        body: [
            'Hvis du har spørsmål om vilkårene eller bruk av tjenesten, kan du bruke kontaktinformasjonen som til enhver tid er oppgitt for Svelta.',
        ],
    },
];

export default function TermsPage() {
    const updatedAt = '25. mai 2026';

    return (
        <main className="min-h-screen pb-24">
            <div className="mx-auto max-w-4xl px-4 py-8">
                <div className="rounded-xl bg-[#f2f1e8] p-6 text-[#12340d] shadow-sm md:p-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6c8765]">
                        Svelta
                    </p>
                    <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">
                        Vilkår og betingelser
                    </h1>
                    <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#496444] md:text-base">
                        Denne siden beskriver hovedvilkårene for bruk av Svelta. Teksten er skrevet
                        for å være forståelig og gjenspeile hvordan appen fungerer i dag.
                    </p>
                    <p className="mt-3 text-sm font-medium text-[#496444]">
                        Sist oppdatert: {updatedAt}
                    </p>
                </div>

                <div className="mt-6 space-y-4">
                    {sections.map((section) => (
                        <section
                            key={section.title}
                            className="rounded-xl border border-[#e4e1d3] bg-white/95 p-5 shadow-sm md:p-6"
                        >
                            <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
                            <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600 md:text-base">
                                {section.body.map((paragraph) => (
                                    <p key={paragraph}>{paragraph}</p>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                <div className="mt-6 rounded-xl border border-[#d9dfcf] bg-[#fbfaf4] p-5 text-sm leading-relaxed text-slate-600 shadow-sm">
                    <p>
                        For bakgrunn om rett til sletting og klare vilkår for digitale tjenester, har
                        vi lagt vekt på veiledning fra{' '}
                        <a
                            href="https://www.datatilsynet.no/rettigheter-og-plikter/den-registrertes-rettigheter/rett-til-sletting/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[#12340d] underline underline-offset-4"
                        >
                            Datatilsynet
                        </a>{' '}
                        og{' '}
                        <a
                            href="https://www.forbrukertilsynet.no/vi-jobber-med/digitalevilkar"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[#12340d] underline underline-offset-4"
                        >
                            Forbrukertilsynet
                        </a>
                        .
                    </p>
                    <p className="mt-3">
                        Hvis du trenger en juridisk gjennomgang til publisering, bør disse vilkårene
                        vurderes av jurist før de brukes som endelig avtaletekst.
                    </p>
                </div>

                <div className="mt-6">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-strong)] px-5 py-2.5 font-semibold text-[#12340d] transition hover:bg-[var(--accent)]"
                    >
                        Tilbake til forsiden
                    </Link>
                </div>
            </div>
        </main>
    );
}
