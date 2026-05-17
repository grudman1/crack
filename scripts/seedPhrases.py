#!/usr/bin/env python3
"""
seedPhrases.py — scrape Wikiquote for famous phrases.

Usage:
  python3 scripts/seedPhrases.py            # full run
  python3 scripts/seedPhrases.py --quick    # subset for iteration

Writes src/data/phrases.ts.

Pipeline per source title:
  1. wikiquote.quotes(title)      — fetch up to 20 quotes
  2. Clean wiki markup
  3. normalize() → must be 26-200 letters
  4. Verify Wikipedia URL with HEAD request
  5. Dedupe by normalized letters
"""

from __future__ import annotations

import json
import os
import re
import ssl
import sys
import time
import unicodedata
from pathlib import Path
from urllib.parse import quote as url_quote

# macOS Python ships without a usable CA bundle by default. Point at certifi.
try:
    import certifi
    ssl._create_default_https_context = lambda *a, **kw: ssl.create_default_context(cafile=certifi.where())
except ImportError:
    pass

import requests
import wikiquote

# ---------------------------------------------------------------------------
# Config

MIN_LETTERS = 26
MAX_LETTERS = 200
RATE_LIMIT_SEC = 0.25  # ~4/sec
OUT_PATH = "src/data/phrases.ts"
CACHE_DIR = Path(".cache/wikiquote")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Seed lists. These are well-known titles drawn from AFI's 100 Greatest Movie
# Quotes, Modern Library / Time 100 Best Novels, lists of films considered
# the best, Wikipedia "List of speeches", Wikipedia "Lists of catchphrases",
# and IMDb / Wikiquote popular categories. Wikiquote pages typically live at
# the bare title; we'll try each and skip on miss.

FILMS = [
    # AFI Top 100 + classics with notable Wikiquote pages
    "The Godfather", "The Godfather Part II", "Pulp Fiction", "Casablanca",
    "Gone with the Wind", "The Wizard of Oz", "Citizen Kane", "Lawrence of Arabia",
    "The Searchers", "Some Like It Hot", "Singin' in the Rain", "It's a Wonderful Life",
    "Sunset Boulevard", "On the Waterfront", "Schindler's List", "Vertigo",
    "Star Wars", "The Empire Strikes Back", "Return of the Jedi",
    "The Lord of the Rings: The Fellowship of the Ring",
    "The Lord of the Rings: The Two Towers",
    "The Lord of the Rings: The Return of the King",
    "The Dark Knight", "The Shawshank Redemption", "Fight Club", "The Matrix",
    "Apocalypse Now", "Forrest Gump", "The Princess Bride", "A Few Good Men",
    "Glengarry Glen Ross", "Network", "Wall Street", "Taxi Driver", "Goodfellas",
    "Reservoir Dogs", "Inglourious Basterds", "Django Unchained", "Kill Bill",
    "Jackie Brown", "The Hateful Eight", "Once Upon a Time in Hollywood",
    "Raiders of the Lost Ark", "Indiana Jones and the Temple of Doom",
    "Indiana Jones and the Last Crusade", "Jurassic Park", "Jaws", "E.T. the Extra-Terrestrial",
    "Saving Private Ryan", "Schindler's List", "Lincoln", "Munich",
    "2001: A Space Odyssey", "A Clockwork Orange", "The Shining", "Full Metal Jacket",
    "Eyes Wide Shut", "Dr. Strangelove", "Barry Lyndon",
    "Annie Hall", "Manhattan", "Hannah and Her Sisters", "Crimes and Misdemeanors",
    "Midnight in Paris", "Bullets Over Broadway",
    "The Departed", "Gangs of New York", "Casino", "Raging Bull", "Mean Streets",
    "The Wolf of Wall Street", "Shutter Island", "After Hours",
    "Breakfast at Tiffany's", "Roman Holiday", "Sabrina", "Charade",
    "Rear Window", "North by Northwest", "Psycho", "The Birds",
    "Notorious", "Strangers on a Train", "Rope",
    "12 Angry Men", "Mr. Smith Goes to Washington", "It Happened One Night",
    "The Apartment", "Witness for the Prosecution",
    "All About Eve", "Sunset Boulevard", "Double Indemnity",
    "The Maltese Falcon", "The Big Sleep",
    "Cool Hand Luke", "Cat on a Hot Tin Roof", "Streetcar Named Desire",
    "The Graduate", "Bonnie and Clyde", "Easy Rider",
    "One Flew Over the Cuckoo's Nest", "All the President's Men",
    "Chinatown", "Three Days of the Condor", "The Conversation",
    "Rocky", "Raging Bull", "Rocky Balboa", "Rocky II",
    "Scarface", "Carlito's Way", "Heat", "The Insider",
    "Blade Runner", "Blade Runner 2049", "Alien", "Aliens",
    "The Terminator", "Terminator 2: Judgment Day", "True Lies",
    "Die Hard", "Lethal Weapon",
    "Back to the Future", "Back to the Future Part II", "Back to the Future Part III",
    "Ghostbusters", "Caddyshack", "Stripes", "The Blues Brothers",
    "Animal House", "Trading Places", "Coming to America",
    "Groundhog Day", "Stripes", "When Harry Met Sally...",
    "Sleepless in Seattle", "You've Got Mail",
    "The Big Lebowski", "Fargo", "No Country for Old Men", "Raising Arizona",
    "O Brother, Where Art Thou?", "Burn After Reading", "True Grit",
    "Inception", "Interstellar", "Memento", "The Prestige",
    "Tenet", "Dunkirk", "Oppenheimer",
    "Goodfellas", "Casino", "The Irishman",
    "American Beauty", "Boogie Nights", "Magnolia", "There Will Be Blood",
    "Phantom Thread", "The Master",
    "No Country for Old Men", "Blood Simple",
    "Boyhood", "Before Sunrise", "Before Sunset", "Before Midnight",
    "Lost in Translation", "Marie Antoinette",
    "Birdman", "The Revenant", "Babel",
    "Spirited Away", "My Neighbor Totoro", "Howl's Moving Castle",
    "Princess Mononoke", "Castle in the Sky",
    "The Lion King", "Beauty and the Beast", "Aladdin", "Frozen",
    "Toy Story", "Finding Nemo", "WALL-E", "Up", "Ratatouille",
    "Monsters, Inc.", "Inside Out", "Coco",
    "The Incredibles", "Cars",
    "Shrek", "Madagascar", "Kung Fu Panda", "How to Train Your Dragon",
    "Mary Poppins", "The Sound of Music", "Chitty Chitty Bang Bang",
    "Willy Wonka & the Chocolate Factory",
    "Harry Potter and the Philosopher's Stone",
    "Harry Potter and the Chamber of Secrets",
    "Harry Potter and the Prisoner of Azkaban",
    "Harry Potter and the Goblet of Fire",
    "Harry Potter and the Order of the Phoenix",
    "Harry Potter and the Half-Blood Prince",
    "Harry Potter and the Deathly Hallows – Part 1",
    "Harry Potter and the Deathly Hallows – Part 2",
    "Pirates of the Caribbean: The Curse of the Black Pearl",
    "The Hobbit: An Unexpected Journey",
    "Avatar", "Titanic",
    "The Sixth Sense", "Unbreakable", "Signs",
    "Spider-Man", "Spider-Man 2", "Iron Man", "The Avengers",
    "The Lego Movie",
    "Get Out", "Us", "Nope",
    "Parasite", "Memories of Murder",
    "Old Boy", "The Handmaiden",
    "Amélie", "The Intouchables",
    "Life Is Beautiful", "Cinema Paradiso",
    "Pan's Labyrinth",
    "Crouching Tiger, Hidden Dragon",
    "Slumdog Millionaire",
    "12 Years a Slave", "Moonlight", "Lady Bird",
    "Three Billboards Outside Ebbing, Missouri",
    "The Truman Show", "Pleasantville", "American History X",
    "Memento", "Donnie Darko", "Mulholland Drive",
    "Eternal Sunshine of the Spotless Mind",
    "Adaptation.", "Being John Malkovich",
    "Network", "Dog Day Afternoon", "All the President's Men",
    "JFK", "Nixon", "W.",
    "The Pianist", "The Reader", "Atonement",
    "There Will Be Blood", "No Country for Old Men",
    "Spotlight", "The Big Short",
    "American Hustle", "Silver Linings Playbook",
    "Brokeback Mountain", "Crash",
    "Million Dollar Baby", "Gran Torino", "Unforgiven",
    "Field of Dreams", "Bull Durham", "A League of Their Own",
    "Hoosiers", "Rudy", "Remember the Titans",
    "Mrs. Doubtfire", "Good Will Hunting", "Dead Poets Society",
    "The Theory of Everything", "A Beautiful Mind",
    "The Imitation Game",
    "The Hurt Locker", "Zero Dark Thirty",
    "American Sniper", "Lone Survivor",
    "Boys Don't Cry", "Million Dollar Baby",
    "Erin Brockovich", "Norma Rae",
    "Philadelphia", "Schindler's List",
    "The Color Purple",
    "Driving Miss Daisy",
    "Forrest Gump", "Cast Away",
    "Saving Mr. Banks",
    "Moneyball", "The Social Network",
    "Captain Phillips", "Bridge of Spies",
]

BOOKS = [
    # Time / Modern Library 100 Best Novels + classics with rich Wikiquote pages
    "Pride and Prejudice", "Sense and Sensibility", "Emma", "Mansfield Park",
    "Persuasion", "Northanger Abbey",
    "Jane Eyre", "Wuthering Heights",
    "Great Expectations", "A Tale of Two Cities", "Oliver Twist", "Bleak House",
    "David Copperfield", "Hard Times", "Nicholas Nickleby",
    "Frankenstein", "Dracula",
    "Moby-Dick", "The Scarlet Letter",
    "The Adventures of Huckleberry Finn", "The Adventures of Tom Sawyer",
    "Anna Karenina", "War and Peace",
    "Crime and Punishment", "The Brothers Karamazov", "The Idiot",
    "Notes from Underground",
    "Madame Bovary", "Sentimental Education",
    "Les Misérables", "The Hunchback of Notre-Dame",
    "Don Quixote",
    "Ulysses", "A Portrait of the Artist as a Young Man", "Dubliners",
    "Finnegans Wake",
    "Mrs. Dalloway", "To the Lighthouse", "Orlando: A Biography",
    "The Sun Also Rises", "A Farewell to Arms", "For Whom the Bell Tolls",
    "The Old Man and the Sea",
    "The Great Gatsby", "Tender Is the Night", "This Side of Paradise",
    "The Sound and the Fury", "As I Lay Dying", "Light in August",
    "Absalom, Absalom!",
    "1984", "Animal Farm",
    "Brave New World", "Brave New World Revisited",
    "Fahrenheit 451", "The Martian Chronicles",
    "Slaughterhouse-Five", "Cat's Cradle", "Breakfast of Champions",
    "Catch-22",
    "To Kill a Mockingbird", "Go Set a Watchman",
    "The Catcher in the Rye", "Franny and Zooey",
    "On the Road", "Dharma Bums",
    "Lolita", "Pale Fire", "Pnin",
    "Lord of the Flies",
    "A Clockwork Orange",
    "One Hundred Years of Solitude", "Love in the Time of Cholera",
    "Chronicle of a Death Foretold",
    "Beloved", "Song of Solomon",
    "Their Eyes Were Watching God",
    "Invisible Man",
    "The Bell Jar",
    "The Grapes of Wrath", "Of Mice and Men", "East of Eden",
    "The Road", "No Country for Old Men", "Blood Meridian",
    "Infinite Jest",
    "The Lord of the Rings", "The Hobbit", "The Silmarillion",
    "A Game of Thrones", "A Clash of Kings", "A Storm of Swords",
    "The Hitchhiker's Guide to the Galaxy",
    "Foundation",
    "Dune", "Dune Messiah", "Children of Dune",
    "Snow Crash", "Cryptonomicon",
    "Neuromancer",
    "Hyperion",
    "Stranger in a Strange Land",
    "Do Androids Dream of Electric Sheep?", "Ubik", "The Man in the High Castle",
    "The Stand", "It", "The Shining",
    "The Sun Also Rises",
    "Things Fall Apart",
    "Heart of Darkness",
    "The Picture of Dorian Gray",
    "The Importance of Being Earnest",
    "Hamlet", "Macbeth", "Romeo and Juliet", "King Lear", "Othello",
    "A Midsummer Night's Dream", "The Tempest", "Julius Caesar",
    "Twelfth Night", "Much Ado About Nothing",
    "Henry V", "Richard III", "Henry IV, Part 1", "Henry IV, Part 2",
    "Pygmalion",
    "Death of a Salesman", "The Crucible", "A View from the Bridge",
    "A Streetcar Named Desire", "Cat on a Hot Tin Roof", "The Glass Menagerie",
    "Long Day's Journey into Night",
    "Waiting for Godot",
    "The Importance of Being Earnest",
    "Cyrano de Bergerac",
    "Faust",
    "The Divine Comedy", "Inferno",
    "Paradise Lost",
    "The Iliad", "The Odyssey",
    "The Aeneid",
    "Beowulf",
    "The Canterbury Tales",
    "The Brothers Karamazov",
    "The Master and Margarita",
    "Doctor Zhivago",
    "Cancer Ward", "One Day in the Life of Ivan Denisovich",
    "The Trial", "The Castle", "The Metamorphosis",
    "Steppenwolf", "Siddhartha", "The Glass Bead Game",
    "Magic Mountain", "Death in Venice", "Buddenbrooks",
    "The Stranger", "The Plague", "The Fall",
    "Nausea", "No Exit",
]

AUTHORS = [
    "William Shakespeare", "Mark Twain", "Oscar Wilde", "Albert Einstein",
    "Winston Churchill", "Abraham Lincoln", "Mahatma Gandhi", "Theodore Roosevelt",
    "Franklin D. Roosevelt", "John F. Kennedy", "Ronald Reagan", "Barack Obama",
    "Eleanor Roosevelt", "Maya Angelou", "Martin Luther King Jr.",
    "Friedrich Nietzsche", "Søren Kierkegaard", "Plato", "Aristotle", "Socrates",
    "Confucius", "Lao Tzu", "Sun Tzu",
    "Charles Dickens", "Jane Austen", "Emily Brontë", "Charlotte Brontë",
    "Leo Tolstoy", "Fyodor Dostoevsky", "Anton Chekhov",
    "Ernest Hemingway", "F. Scott Fitzgerald", "William Faulkner",
    "John Steinbeck", "Kurt Vonnegut", "Ray Bradbury",
    "George Orwell", "Aldous Huxley",
    "Virginia Woolf", "James Joyce",
    "J. R. R. Tolkien", "C. S. Lewis", "Lewis Carroll",
    "George R. R. Martin",
    "Ursula K. Le Guin",
    "Isaac Asimov", "Arthur C. Clarke", "Philip K. Dick",
    "Stephen King",
    "Margaret Atwood", "Toni Morrison", "Maya Angelou",
    "Gabriel García Márquez", "Jorge Luis Borges",
    "Italo Calvino", "Umberto Eco",
    "Haruki Murakami",
    "Mark Twain", "Henry David Thoreau", "Ralph Waldo Emerson",
    "Walt Whitman", "Emily Dickinson", "Robert Frost",
    "T. S. Eliot", "W. B. Yeats", "Sylvia Plath",
    "Edgar Allan Poe", "H. P. Lovecraft",
    "Yogi Berra", "Mark Twain", "P. G. Wodehouse",
    "Douglas Adams", "Terry Pratchett",
    "George Carlin", "Mitch Hedberg",
    "Steve Jobs", "Bill Gates", "Elon Musk", "Warren Buffett",
    "Walt Disney",
    "Henry Ford",
    "Carl Sagan", "Stephen Hawking", "Richard Feynman",
    "Charles Darwin",
    "Sigmund Freud", "Carl Jung",
    "Bertrand Russell",
    "Voltaire", "Jean-Jacques Rousseau",
    "John Lennon", "Bob Dylan", "Leonard Cohen",
    "Frank Zappa",
    "Hunter S. Thompson",
    "Christopher Hitchens",
]

TV_SHOWS = [
    "The Sopranos", "The Wire", "Breaking Bad", "Better Call Saul",
    "Mad Men", "The Crown", "Succession",
    "Game of Thrones", "House of the Dragon",
    "Friends", "Seinfeld", "Cheers", "Frasier",
    "The Simpsons", "Futurama", "South Park", "Family Guy",
    "Arrested Development", "30 Rock", "Parks and Recreation",
    "The Office (American TV series)", "The Office (British TV series)",
    "Curb Your Enthusiasm",
    "Veep", "Silicon Valley",
    "It's Always Sunny in Philadelphia",
    "Modern Family", "Community", "How I Met Your Mother",
    "The Big Bang Theory",
    "Lost", "Battlestar Galactica",
    "The X-Files", "Twin Peaks",
    "Star Trek: The Next Generation", "Star Trek: Deep Space Nine",
    "Doctor Who",
    "Mr. Robot",
    "Black Mirror",
    "Stranger Things",
    "Buffy the Vampire Slayer", "Angel",
    "Firefly", "Serenity",
    "Mad Men", "The Americans",
    "Deadwood",
    "True Detective",
    "Fargo (TV series)",
    "The West Wing", "Hill Street Blues",
    "ER",
    "House (TV series)", "Scrubs",
    "Sex and the City",
    "M*A*S*H",
    "Star Trek: The Original Series",
    "Babylon 5",
]

SPEECHES = [
    "I Have a Dream",
    "Gettysburg Address",
    "We shall fight on the beaches",
    "Tear down this wall!",
    "Inaugural address of John F. Kennedy",
    "Ich bin ein Berliner",
    "A More Perfect Union (speech)",
    "Atoms for Peace",
    "Four Freedoms",
    "Cross of Gold speech",
    "Funeral Oration (Pericles)",
]

SONGS = [
    "Bohemian Rhapsody", "Imagine (John Lennon song)",
    "Like a Rolling Stone", "Yesterday (Beatles song)",
    "Hey Jude", "Let It Be (Beatles song)",
    "Stairway to Heaven",
    "Hotel California (song)",
    "American Pie (Don McLean song)",
    "Hallelujah (Leonard Cohen song)",
]

# ---------------------------------------------------------------------------
# Helpers

def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z]", "", text)
    return text.lower()

def slugify(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]", "_", s)[:80]

def cache_get(key: str):
    f = CACHE_DIR / f"{key}.json"
    if f.exists():
        try:
            return json.loads(f.read_text())
        except Exception:
            return None
    return None

def cache_put(key: str, value) -> None:
    f = CACHE_DIR / f"{key}.json"
    f.write_text(json.dumps(value, ensure_ascii=False))

_TOC_RE = re.compile(r"\b(Season|Episode|Part|Chapter|Book|Volume|Act|Disc|Track)\s+\d+", re.IGNORECASE)
_TOC_NOISE_THRESHOLD = 3  # ≥3 hits in one quote = it's a table of contents, not a quote
_CITATION_MARKERS = (
    "translated into",
    "translated from",
    "reprinted in",
    "reprinted from",
    "ISBN ",
    "OCLC ",
    "Track listing",
    "Tracklist",
    "Bibliography",
    "External links",
    "Filmography",
    "Discography",
    "See also",
)

def looks_like_toc_or_citation(s: str) -> bool:
    """Drop quotes that are really table-of-contents lists or bibliography
    fragments accidentally pulled out of a Wikiquote page."""
    if not s:
        return True
    if len(_TOC_RE.findall(s)) >= _TOC_NOISE_THRESHOLD:
        return True
    lower = s.lower()
    for marker in _CITATION_MARKERS:
        if marker.lower() in lower:
            return True
    return False

def clean_text(s: str) -> str:
    if not s:
        return ""
    # Strip wiki link markup: [[Link|Display]] → Display, [[Link]] → Link
    s = re.sub(r"\[\[([^\]|]*\|)?([^\]]*)\]\]", r"\2", s)
    # Bold and italic markers
    s = re.sub(r"'''+", "", s)
    s = re.sub(r"''+", "", s)
    # HTML tags
    s = re.sub(r"<[^>]+>", "", s)
    # File/image embeds — drop
    s = re.sub(r"\{\{[^}]+\}\}", "", s)
    # Refs
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.DOTALL)
    s = re.sub(r"<ref[^/]*/>", "", s)
    # Stage directions / editorial asides inside [brackets]
    s = re.sub(r"\[[^\]]*\]", "", s)
    # Parenthetical translations / asides — drop only if they look editorial
    # (keep parens that are part of the original line)
    # Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()
    # Trim leading colons/dashes left after editorial strip
    s = re.sub(r"^[\s:\-–—]+", "", s)
    # Strip trailing Wikiquote editorial annotations
    s = re.sub(r"\s*Note:\s.*$", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s*Source:\s.*$", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s*Episode:\s.*$", "", s, flags=re.IGNORECASE)
    # Drop entries containing obvious Wikiquote meta-text
    if "American Film Institute" in s and "nominated" in s:
        return ""
    s = re.sub(r"\s+", " ", s).strip()
    # Remove surrounding quote marks
    s = s.strip("'\"“”‘’ ")
    return s

def fetch_quotes(title: str) -> list:
    key = f"quotes_{slugify(title)}"
    cached = cache_get(key)
    if cached is not None:
        return cached
    try:
        quotes = wikiquote.quotes(title, max_quotes=20)
        result = list(quotes) if quotes else []
    except Exception as e:
        msg = str(e)[:80]
        print(f"    ! {title}: {type(e).__name__} {msg}", file=sys.stderr)
        result = []
    time.sleep(RATE_LIMIT_SEC)
    cache_put(key, result)
    return result

UA = "CRACK-name-game-seed/1.0 (https://github.com/grudman1/crack)"

def verify_url(title: str) -> dict:
    key = f"verify_{slugify(title)}"
    cached = cache_get(key)
    if cached is not None:
        return cached
    url = f"https://en.wikipedia.org/wiki/{url_quote(title.replace(' ', '_'))}"
    ok = False
    final = url
    try:
        r = requests.head(url, allow_redirects=True, timeout=10, headers={"User-Agent": UA})
        ok = r.status_code == 200
        final = r.url
    except Exception:
        pass
    time.sleep(RATE_LIMIT_SEC)
    result = {"ok": ok, "url": final if ok else url}
    cache_put(key, result)
    return result

# ---------------------------------------------------------------------------
# Main

def write_ts(phrases: list) -> None:
    Path("src/data").mkdir(parents=True, exist_ok=True)
    lines = [
        "// GENERATED by scripts/seedPhrases.py — do not edit by hand.",
        "// Sources: Wikiquote (quotes) and Wikipedia (URLs); both CC BY-SA.",
        "// Each entry shows a short excerpt; the source link goes to the",
        "// full article on Wikipedia.",
        "//",
        "// To regenerate: python3 scripts/seedPhrases.py",
        "",
        "import type { Phrase, SourceType } from '@/services/phraseService';",
        "",
        "// Factory: typed parameters prevent the array-literal type from",
        "// expanding into a massive union (TS would otherwise hit error",
        "// TS2590 on ~3000+ entries).",
        "const p = (",
        "  text: string,",
        "  source: string,",
        "  sourceType: SourceType,",
        "  wikipediaUrl: string,",
        "  letters: string,",
        "): Phrase => ({ text, source, sourceType, wikipediaUrl, letters });",
        "",
        "export const PHRASES: Phrase[] = [",
    ]
    for p_entry in phrases:
        lines.append(
            "  p("
            f"{json.dumps(p_entry['text'], ensure_ascii=False)}, "
            f"{json.dumps(p_entry['source'], ensure_ascii=False)}, "
            f"{json.dumps(p_entry['sourceType'])}, "
            f"{json.dumps(p_entry['wikipediaUrl'])}, "
            f"{json.dumps(p_entry['letters'])}"
            "),"
        )
    lines.append("];")
    lines.append("")
    Path(OUT_PATH).write_text("\n".join(lines))

def clean_source_title(title: str) -> str:
    # "Foo (TV series)" → "Foo", "Foo (song)" → "Foo", etc.
    return re.sub(r"\s*\([^)]*\)\s*$", "", title).strip()

def main() -> None:
    quick = "--quick" in sys.argv

    sources = [
        ("film", FILMS),
        ("literature", BOOKS),
        ("literature", AUTHORS),
        ("tv", TV_SHOWS),
        ("speech", SPEECHES),
        ("song", SONGS),
    ]
    if quick:
        sources = [(t, lst[:10]) for t, lst in sources]

    stats = {
        "titles_tried": 0,
        "titles_with_quotes": 0,
        "raw_quotes": 0,
        "too_short": 0,
        "too_long": 0,
        "noise_filtered": 0,
        "dead_url": 0,
        "deduped": 0,
        "final": 0,
        "by_type": {},
    }
    seen_letters: set[str] = set()
    phrases: list[dict] = []

    for source_type, titles in sources:
        print(f"\n=== {source_type.upper()} ({len(titles)} titles) ===", flush=True)
        for title in titles:
            stats["titles_tried"] += 1
            quotes = fetch_quotes(title)
            kept_for_title = 0
            if quotes:
                stats["titles_with_quotes"] += 1
            for raw in quotes:
                stats["raw_quotes"] += 1
                text = clean_text(raw)
                if not text:
                    continue
                if looks_like_toc_or_citation(text):
                    stats["noise_filtered"] += 1
                    continue
                letters = normalize(text)
                if len(letters) < MIN_LETTERS:
                    stats["too_short"] += 1
                    continue
                if len(letters) > MAX_LETTERS:
                    stats["too_long"] += 1
                    continue
                if letters in seen_letters:
                    stats["deduped"] += 1
                    continue
                v = verify_url(title)
                if not v["ok"]:
                    stats["dead_url"] += 1
                    continue
                seen_letters.add(letters)
                phrases.append(
                    {
                        "text": text,
                        "source": clean_source_title(title),
                        "sourceType": source_type,
                        "wikipediaUrl": v["url"],
                        "letters": letters,
                    }
                )
                stats["by_type"][source_type] = stats["by_type"].get(source_type, 0) + 1
                stats["final"] += 1
                kept_for_title += 1
            print(f"  {title!s:.55s}  raw={len(quotes):>2}  kept={kept_for_title:>2}  total={stats['final']}", flush=True)

    print(f"\nWriting {len(phrases)} phrases → {OUT_PATH}")
    write_ts(phrases)
    print("\n=== STATS ===")
    for k, v in stats.items():
        print(f"  {k}: {v}")

if __name__ == "__main__":
    main()
