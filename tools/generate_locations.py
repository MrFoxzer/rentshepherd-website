#!/usr/bin/env python3
"""RentShepherd programmatic-SEO location page generator.

Builds locations/<state>.html (50), locations/<city>-<st>.html (25),
locations/index.html (hub), sitemap.xml and robots.txt from data + rotating
templates. Deterministic: every variant choice is a hash of the location name,
so re-running the script reproduces identical pages.

Usage:  python3 tools/generate_locations.py            # generate + validate
        python3 tools/generate_locations.py --validate # validate only

Hard content rules honored here:
- No invented statistics, no fake local offices/teams, no fabricated
  customer counts or testimonials. These are service-area pages for a
  cloud product available in each location.
"""

import hashlib
import json
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOC_DIR = os.path.join(ROOT, "locations")
DOMAIN = "https://rentshepherd.com"
TODAY = "2026-08-26"

# ---------------------------------------------------------------------------
# DATA — 50 states
# name, abbr, [major cities], [4 nearby states], climate (cold/hot/mixed),
# market phrase (honest, generic local color; no stats)
# ---------------------------------------------------------------------------

STATES = [
    ("Alabama", "AL", ["Birmingham", "Huntsville", "Montgomery", "Mobile", "Tuscaloosa"],
     ["Georgia", "Tennessee", "Mississippi", "Florida"], "hot",
     "college rentals around Tuscaloosa and Auburn, Huntsville's growing tech corridor, and single-family rentals across the Birmingham suburbs"),
    ("Alaska", "AK", ["Anchorage", "Fairbanks", "Juneau", "Wasilla"],
     ["Washington", "Oregon", "California", "Idaho"], "cold",
     "Anchorage apartments, seasonal workforce housing, and owners who manage cabins and rentals from hundreds of miles away"),
    ("Arizona", "AZ", ["Phoenix", "Tucson", "Mesa", "Scottsdale", "Flagstaff"],
     ["California", "Nevada", "Utah", "New Mexico"], "hot",
     "the sprawling Phoenix and Mesa apartment market, student rentals around ASU in Tempe, and heavy winter snowbird demand"),
    ("Arkansas", "AR", ["Little Rock", "Fayetteville", "Fort Smith", "Bentonville"],
     ["Missouri", "Tennessee", "Oklahoma", "Texas"], "mixed",
     "the fast-growing Northwest Arkansas corridor around Fayetteville and Bentonville, Razorback student rentals, and single-family homes across Little Rock"),
    ("California", "CA", ["Los Angeles", "San Diego", "San Francisco", "San Jose", "Sacramento"],
     ["Oregon", "Nevada", "Arizona", "Washington"], "mixed",
     "dense apartment corridors in Los Angeles and the Bay Area, college markets from Berkeley to San Diego, and backyard ADUs in single-family neighborhoods"),
    ("Colorado", "CO", ["Denver", "Colorado Springs", "Aurora", "Boulder", "Fort Collins"],
     ["Wyoming", "Nebraska", "Kansas", "Utah"], "cold",
     "Denver's apartment corridors, college rentals in Boulder and Fort Collins, and mountain-town homes with seasonal swings"),
    ("Connecticut", "CT", ["Hartford", "New Haven", "Stamford", "Bridgeport"],
     ["New York", "Massachusetts", "Rhode Island", "New Jersey"], "cold",
     "commuter apartments in Stamford and along the Metro-North corridor, college rentals around New Haven, and multifamily stock in Hartford and Bridgeport"),
    ("Delaware", "DE", ["Wilmington", "Dover", "Newark", "Rehoboth Beach"],
     ["Maryland", "Pennsylvania", "New Jersey", "Virginia"], "mixed",
     "Wilmington apartments, University of Delaware rentals in Newark, and beach-town homes around Rehoboth"),
    ("Florida", "FL", ["Miami", "Tampa", "Orlando", "Jacksonville", "St. Petersburg"],
     ["Georgia", "Alabama", "South Carolina", "Tennessee"], "hot",
     "condo towers in Miami, single-family rentals across the Tampa and Orlando suburbs, and heavy seasonal demand statewide"),
    ("Georgia", "GA", ["Atlanta", "Savannah", "Augusta", "Athens", "Columbus"],
     ["Florida", "Alabama", "Tennessee", "South Carolina"], "hot",
     "Atlanta's sprawling apartment and single-family rental market, college towns like Athens, and fast-growing suburbs from Marietta to Gwinnett"),
    ("Hawaii", "HI", ["Honolulu", "Hilo", "Kailua", "Pearl City"],
     ["California", "Washington", "Oregon", "Nevada"], "hot",
     "Honolulu high-rises, long-term rentals sitting alongside a heavy visitor market, and owners who often manage from the mainland"),
    ("Idaho", "ID", ["Boise", "Meridian", "Idaho Falls", "Coeur d'Alene"],
     ["Washington", "Oregon", "Montana", "Utah"], "cold",
     "Boise's fast-growing rental market, Boise State student housing, and resort-area homes around Coeur d'Alene and Sun Valley"),
    ("Illinois", "IL", ["Chicago", "Aurora", "Naperville", "Springfield", "Peoria"],
     ["Wisconsin", "Indiana", "Iowa", "Missouri"], "cold",
     "Chicago two-flats and three-flats, Big Ten college towns like Champaign, and single-family rentals across the collar counties"),
    ("Indiana", "IN", ["Indianapolis", "Fort Wayne", "Bloomington", "South Bend"],
     ["Illinois", "Ohio", "Michigan", "Kentucky"], "cold",
     "Indianapolis single-family rentals, Big Ten college markets in Bloomington and West Lafayette, and steady Midwestern multifamily stock"),
    ("Iowa", "IA", ["Des Moines", "Cedar Rapids", "Iowa City", "Davenport"],
     ["Minnesota", "Wisconsin", "Illinois", "Nebraska"], "cold",
     "college rentals in Iowa City and Ames, Des Moines's growing apartment market, and affordable single-family stock across the state"),
    ("Kansas", "KS", ["Wichita", "Overland Park", "Topeka", "Lawrence"],
     ["Missouri", "Nebraska", "Oklahoma", "Colorado"], "mixed",
     "the Kansas City suburbs of Johnson County, college rentals in Lawrence and Manhattan, and Wichita's single-family market"),
    ("Kentucky", "KY", ["Louisville", "Lexington", "Bowling Green", "Owensboro"],
     ["Tennessee", "Indiana", "Ohio", "Illinois"], "mixed",
     "Louisville and Lexington single-family rentals, college housing around UK and WKU, and military-area demand near Fort Knox and Fort Campbell"),
    ("Louisiana", "LA", ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette"],
     ["Texas", "Arkansas", "Mississippi", "Alabama"], "hot",
     "New Orleans doubles and shotgun-house rentals, LSU student housing in Baton Rouge, and steady industrial workforce demand"),
    ("Maine", "ME", ["Portland", "Bangor", "Augusta", "Lewiston"],
     ["New Hampshire", "Massachusetts", "Vermont", "Rhode Island"], "cold",
     "Portland's in-demand peninsula apartments, college rentals in Orono, and coastal homes that turn to year-round tenants each fall"),
    ("Maryland", "MD", ["Baltimore", "Columbia", "Annapolis", "Silver Spring"],
     ["Virginia", "Pennsylvania", "Delaware", "West Virginia"], "mixed",
     "Baltimore rowhouse rentals, DC-commuter apartments in Silver Spring and Rockville, and the college market around College Park"),
    ("Massachusetts", "MA", ["Boston", "Worcester", "Springfield", "Cambridge", "Lowell"],
     ["New York", "Connecticut", "Rhode Island", "New Hampshire"], "cold",
     "Boston triple-deckers, the famous September 1 student-rental cycle, and commuter-rail markets from Worcester to Lowell"),
    ("Michigan", "MI", ["Detroit", "Grand Rapids", "Ann Arbor", "Lansing"],
     ["Ohio", "Indiana", "Wisconsin", "Illinois"], "cold",
     "Detroit and Grand Rapids single-family rentals, student housing in Ann Arbor and East Lansing, and lakeshore homes with seasonal swings"),
    ("Minnesota", "MN", ["Minneapolis", "St. Paul", "St. Cloud", "Rochester", "Duluth"],
     ["Wisconsin", "Iowa", "North Dakota", "South Dakota"], "cold",
     "Twin Cities duplexes and apartment corridors, college rentals around the U of M and St. Cloud State, and lake-country single-family homes"),
    ("Mississippi", "MS", ["Jackson", "Gulfport", "Hattiesburg", "Oxford"],
     ["Louisiana", "Arkansas", "Tennessee", "Alabama"], "hot",
     "college rentals in Oxford, Starkville, and Hattiesburg, Gulf Coast workforce housing, and affordable single-family stock around Jackson"),
    ("Missouri", "MO", ["Kansas City", "St. Louis", "Springfield", "Columbia"],
     ["Kansas", "Iowa", "Illinois", "Arkansas"], "mixed",
     "Kansas City and St. Louis single-family rentals, Mizzou student housing in Columbia, and steady Midwestern multifamily stock"),
    ("Montana", "MT", ["Billings", "Missoula", "Bozeman", "Great Falls"],
     ["North Dakota", "South Dakota", "Wyoming", "Idaho"], "cold",
     "Bozeman and Missoula college rentals, Billings workforce housing, and resort-area homes with sharp seasonal swings"),
    ("Nebraska", "NE", ["Omaha", "Lincoln", "Grand Island", "Bellevue"],
     ["Iowa", "Kansas", "South Dakota", "Colorado"], "cold",
     "Omaha's steady rental market, Husker student housing in Lincoln, and affordable single-family stock statewide"),
    ("Nevada", "NV", ["Las Vegas", "Reno", "Henderson", "Sparks"],
     ["California", "Arizona", "Utah", "Oregon"], "hot",
     "Las Vegas single-family rentals and apartment corridors, Reno's growing market, and swing-shift tenants who message at every hour"),
    ("New Hampshire", "NH", ["Manchester", "Nashua", "Concord", "Dover"],
     ["Maine", "Vermont", "Massachusetts", "New York"], "cold",
     "Manchester millyard apartments, college rentals around Durham and Keene, and Lakes Region homes with seasonal demand"),
    ("New Jersey", "NJ", ["Newark", "Jersey City", "Trenton", "Hoboken"],
     ["New York", "Pennsylvania", "Delaware", "Connecticut"], "mixed",
     "dense commuter apartments from Jersey City to Hoboken, Rutgers student rentals, and two-family homes across North Jersey"),
    ("New Mexico", "NM", ["Albuquerque", "Santa Fe", "Las Cruces", "Rio Rancho"],
     ["Arizona", "Colorado", "Texas", "Oklahoma"], "mixed",
     "Albuquerque single-family rentals, UNM student housing, and Santa Fe's mix of long-term homes and seasonal demand"),
    ("New York", "NY", ["New York City", "Buffalo", "Rochester", "Albany", "Syracuse"],
     ["New Jersey", "Pennsylvania", "Connecticut", "Massachusetts"], "cold",
     "New York City walk-ups and multifamily buildings, upstate college towns like Ithaca, and commuter markets across the Hudson Valley"),
    ("North Carolina", "NC", ["Charlotte", "Raleigh", "Durham", "Greensboro", "Chapel Hill"],
     ["Virginia", "South Carolina", "Georgia", "Tennessee"], "mixed",
     "the fast-growing Charlotte and Raleigh-Durham markets, Research Triangle apartments, and college rentals from Chapel Hill to Boone"),
    ("North Dakota", "ND", ["Fargo", "Bismarck", "Grand Forks", "Minot"],
     ["Minnesota", "South Dakota", "Montana", "Wisconsin"], "cold",
     "Fargo's steady rental market anchored by NDSU, oil-patch workforce housing out west, and affordable single-family stock in Bismarck and Grand Forks"),
    ("Ohio", "OH", ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron"],
     ["Pennsylvania", "Michigan", "Indiana", "Kentucky"], "cold",
     "Columbus's fast-growing market around Ohio State, classic Cleveland and Cincinnati doubles, and affordable single-family rentals statewide"),
    ("Oklahoma", "OK", ["Oklahoma City", "Tulsa", "Norman", "Stillwater"],
     ["Texas", "Kansas", "Arkansas", "Missouri"], "mixed",
     "Oklahoma City and Tulsa single-family rentals, college housing in Norman and Stillwater, and steady energy-sector workforce demand"),
    ("Oregon", "OR", ["Portland", "Salem", "Eugene", "Bend"],
     ["Washington", "California", "Idaho", "Nevada"], "mixed",
     "Portland's apartment and ADU market, college rentals in Eugene and Corvallis, and Bend's fast-growing high-desert market"),
    ("Pennsylvania", "PA", ["Philadelphia", "Pittsburgh", "Allentown", "State College"],
     ["New York", "New Jersey", "Ohio", "Maryland"], "cold",
     "Philadelphia rowhouses, Pittsburgh student rentals around Oakland, and college towns from State College to Bethlehem"),
    ("Rhode Island", "RI", ["Providence", "Warwick", "Cranston", "Newport"],
     ["Massachusetts", "Connecticut", "New York", "New Hampshire"], "cold",
     "Providence triple-deckers, college rentals around Brown and URI, and coastal homes with strong summer demand"),
    ("South Carolina", "SC", ["Charleston", "Columbia", "Greenville", "Myrtle Beach"],
     ["North Carolina", "Georgia", "Tennessee", "Florida"], "hot",
     "Charleston's historic rentals and fast-growing suburbs, college housing in Columbia and Clemson, and coastal markets with seasonal swings"),
    ("South Dakota", "SD", ["Sioux Falls", "Rapid City", "Aberdeen", "Brookings"],
     ["North Dakota", "Minnesota", "Nebraska", "Iowa"], "cold",
     "Sioux Falls's steady growth, college rentals in Brookings and Vermillion, and affordable single-family stock statewide"),
    ("Tennessee", "TN", ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Murfreesboro"],
     ["Kentucky", "Georgia", "North Carolina", "Alabama"], "mixed",
     "Nashville's booming apartment market, college rentals in Knoxville and Murfreesboro, and single-family rentals across Memphis"),
    ("Texas", "TX", ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth"],
     ["Oklahoma", "Louisiana", "New Mexico", "Arkansas"], "hot",
     "sprawling apartment markets in Houston and Dallas-Fort Worth, college towns from Austin to College Station, and fast-growing single-family rental suburbs"),
    ("Utah", "UT", ["Salt Lake City", "Provo", "Ogden", "St. George"],
     ["Colorado", "Nevada", "Arizona", "Idaho"], "cold",
     "the fast-growing Wasatch Front rental market, college housing in Provo and Logan, and ski-town homes with seasonal swings"),
    ("Vermont", "VT", ["Burlington", "Montpelier", "Rutland", "Brattleboro"],
     ["New York", "New Hampshire", "Massachusetts", "Maine"], "cold",
     "Burlington's college-driven rental market, ski-town homes with seasonal demand, and small multifamily buildings across the state"),
    ("Virginia", "VA", ["Virginia Beach", "Richmond", "Norfolk", "Arlington", "Charlottesville"],
     ["Maryland", "North Carolina", "Tennessee", "West Virginia"], "mixed",
     "Northern Virginia's commuter apartments, military-area rentals around Norfolk and Virginia Beach, and college towns like Charlottesville and Blacksburg"),
    ("Washington", "WA", ["Seattle", "Spokane", "Tacoma", "Bellevue", "Vancouver"],
     ["Oregon", "Idaho", "Montana", "California"], "mixed",
     "Seattle apartments and backyard cottages, college rentals in Pullman and Bellingham, and fast-growing markets from Tacoma to Spokane"),
    ("West Virginia", "WV", ["Charleston", "Huntington", "Morgantown", "Parkersburg"],
     ["Ohio", "Pennsylvania", "Virginia", "Kentucky"], "cold",
     "Morgantown's WVU student rentals, Charleston and Huntington single-family homes, and affordable multifamily stock statewide"),
    ("Wisconsin", "WI", ["Milwaukee", "Madison", "Green Bay", "Eau Claire"],
     ["Minnesota", "Iowa", "Illinois", "Michigan"], "cold",
     "Milwaukee duplexes, Madison's campus-driven rental market, and single-family rentals from Green Bay to Eau Claire"),
    ("Wyoming", "WY", ["Cheyenne", "Casper", "Laramie", "Jackson"],
     ["Montana", "Colorado", "Utah", "Nebraska"], "cold",
     "Cheyenne and Casper workforce rentals, University of Wyoming housing in Laramie, and resort-area homes around Jackson"),
]

# ---------------------------------------------------------------------------
# DATA — 25 cities
# name, state abbr, state name, [neighborhoods/areas], climate, market phrase
# ---------------------------------------------------------------------------

CITIES = [
    ("Minneapolis", "MN", "Minnesota",
     ["Uptown", "Northeast", "Dinkytown", "the North Loop", "Whittier"], "cold",
     "duplexes and triplexes across South Minneapolis, student rentals in Dinkytown and Marcy-Holmes, and new apartment towers in the North Loop"),
    ("St. Paul", "MN", "Minnesota",
     ["Highland Park", "Cathedral Hill", "Como", "Macalester-Groveland", "the East Side"], "cold",
     "classic brick apartments along Grand Avenue, college rentals around Macalester, Hamline, and St. Thomas, and single-family rentals across the East Side"),
    ("St. Cloud", "MN", "Minnesota",
     ["the South Side", "Pantown", "downtown", "Waite Park", "Sauk Rapids"], "cold",
     "student rentals ringing St. Cloud State, workforce apartments downtown, and single-family rentals out to Waite Park and Sauk Rapids"),
    ("Rochester", "MN", "Minnesota",
     ["Kutzky Park", "the Historic Southwest", "downtown", "Elton Hills"], "cold",
     "medical residents and traveling professionals drawn by Mayo Clinic, downtown apartments, and quiet single-family neighborhoods"),
    ("Fargo", "ND", "North Dakota",
     ["Roosevelt", "Horace Mann", "downtown Broadway", "West Fargo"], "cold",
     "NDSU student rentals north of downtown, Broadway apartments, and fast-growing single-family stock in West Fargo"),
    ("Chicago", "IL", "Illinois",
     ["Lakeview", "Logan Square", "Wicker Park", "Hyde Park", "Rogers Park"], "cold",
     "classic two-flats and three-flats, dense lakefront apartment corridors, and student rentals around Hyde Park and Rogers Park"),
    ("New York", "NY", "New York",
     ["Astoria", "Bushwick", "Bed-Stuy", "Washington Heights", "the Bronx"], "cold",
     "walk-ups and multifamily buildings across the five boroughs, brownstone floor-throughs in Brooklyn, and some of the most layered rental rules in the country"),
    ("Los Angeles", "CA", "California",
     ["Koreatown", "Silver Lake", "North Hollywood", "Westwood", "Echo Park"], "hot",
     "dingbat apartments and fourplexes, backyard ADUs in single-family neighborhoods, and student rentals around Westwood and University Park"),
    ("Houston", "TX", "Texas",
     ["The Heights", "Montrose", "Midtown", "EaDo", "Katy"], "hot",
     "garden apartments inside the Loop, energy-corridor workforce tenants, and single-family rentals sprawling from Katy to Kingwood"),
    ("Dallas", "TX", "Texas",
     ["Uptown", "Deep Ellum", "Bishop Arts", "Lake Highlands", "Richardson"], "hot",
     "Uptown towers, garden apartments along Central Expressway, and single-family rentals across the northern suburbs"),
    ("Austin", "TX", "Texas",
     ["West Campus", "East Austin", "South Congress", "Riverside", "the Domain"], "hot",
     "UT student rentals stacked into West Campus, new towers around the Domain, and East Austin bungalows turned rentals"),
    ("San Antonio", "TX", "Texas",
     ["Alamo Heights", "Southtown", "Stone Oak", "the Medical Center"], "hot",
     "military families cycling through Joint Base San Antonio, Medical Center apartments, and single-family rentals along Loop 1604"),
    ("Phoenix", "AZ", "Arizona",
     ["Tempe", "Arcadia", "Roosevelt Row", "North Phoenix", "Ahwatukee"], "hot",
     "ASU student rentals in Tempe, new build-to-rent communities on the metro's edges, and summer heat that turns AC failures into emergencies"),
    ("Denver", "CO", "Colorado",
     ["Capitol Hill", "RiNo", "Five Points", "Wash Park", "Aurora"], "cold",
     "Capitol Hill apartment blocks, new builds in RiNo, and single-family rentals stretching into Aurora and Lakewood"),
    ("Seattle", "WA", "Washington",
     ["Capitol Hill", "Ballard", "the U District", "Fremont", "West Seattle"], "mixed",
     "UW student rentals in the U District, backyard cottages and mother-in-law units, and apartment corridors from Ballard to Capitol Hill"),
    ("Atlanta", "GA", "Georgia",
     ["Midtown", "Old Fourth Ward", "Buckhead", "East Atlanta", "Decatur"], "hot",
     "BeltLine apartments, Georgia Tech and GSU student rentals, and single-family rentals across a metro that sprawls in every direction"),
    ("Miami", "FL", "Florida",
     ["Brickell", "Wynwood", "Little Havana", "Coral Gables", "North Beach"], "hot",
     "Brickell condo towers rented out unit by unit, strong seasonal demand, and buildings where the condo association is a second landlord to satisfy"),
    ("Tampa", "FL", "Florida",
     ["Hyde Park", "Seminole Heights", "Ybor City", "Westshore", "the USF area"], "hot",
     "bungalow rentals in Seminole Heights, USF student housing, and fast-growing suburbs from Brandon to Wesley Chapel"),
    ("Orlando", "FL", "Florida",
     ["Winter Park", "Baldwin Park", "Lake Nona", "MetroWest", "the UCF corridor"], "hot",
     "UCF's huge student market, hospitality workers on every shift imaginable, and single-family rentals across booming suburbs"),
    ("Charlotte", "NC", "North Carolina",
     ["South End", "NoDa", "Plaza Midwood", "University City", "Ballantyne"], "mixed",
     "South End towers, UNC Charlotte student rentals in University City, and single-family rentals rippling out toward Ballantyne"),
    ("Nashville", "TN", "Tennessee",
     ["East Nashville", "The Gulch", "Germantown", "12South", "Midtown"], "mixed",
     "East Nashville bungalows turned rentals, new towers in the Gulch, and student housing around Vanderbilt and Belmont"),
    ("Las Vegas", "NV", "Nevada",
     ["Summerlin", "Green Valley", "Spring Valley", "the Arts District", "the UNLV area"], "hot",
     "single-family rentals across Summerlin and Henderson, tenants working casino swing shifts, and desert summers where a dead AC cannot wait until morning"),
    ("Columbus", "OH", "Ohio",
     ["the Short North", "German Village", "Clintonville", "the University District", "Grandview"], "cold",
     "Ohio State's massive student market, Short North apartments, and affordable doubles across the city"),
    ("Indianapolis", "IN", "Indiana",
     ["Broad Ripple", "Fountain Square", "Mass Ave", "Irvington", "Butler-Tarkington"], "cold",
     "affordable single-family rentals that investors favor, Broad Ripple and Butler-area student housing, and steady downtown apartment demand"),
    ("Kansas City", "MO", "Missouri",
     ["Westport", "the Crossroads", "Brookside", "Waldo", "River Market"], "mixed",
     "Westport and Waldo apartments, single-family rentals on both sides of the state line, and a downtown that keeps adding renters"),
]


def slugify(name):
    s = name.lower().replace(".", "").replace("'", "")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


STATE_SLUG = {name: slugify(name) for (name, *_rest) in STATES}
CITY_SLUG = {(c[0], c[1]): "%s-%s" % (slugify(c[0]), c[1].lower()) for c in CITIES}
CITIES_BY_STATE = {}
for c in CITIES:
    CITIES_BY_STATE.setdefault(c[2], []).append(c)


# Words that start with a vowel LETTER but a consonant SOUND -> "a Utah".
_A_BEFORE_VOWEL_LETTER = (
    "utah", "utica", "union", "unit", "united", "uniform", "university",
    "usual", "user", "eu", "ewe", "one",
)
# Words that start with a consonant LETTER but a vowel SOUND -> "an hour".
_AN_BEFORE_CONSONANT_LETTER = ("hour", "honest", "honor", "honour", "heir")


def article(word):
    """Return 'a' or 'an' for `word`, chosen by initial SOUND, not spelling."""
    w = re.sub(r"^[^A-Za-z]+", "", word or "").lower()
    if not w:
        return "a"
    if w.startswith(_AN_BEFORE_CONSONANT_LETTER):
        return "an"
    if w.startswith(_A_BEFORE_VOWEL_LETTER):
        return "a"
    return "an" if w[0] in "aeiou" else "a"


def pick(name, salt, options):
    """Deterministic variant selection: hash of location name + section salt."""
    h = int(hashlib.md5((name + "|" + salt).encode("utf-8")).hexdigest(), 16)
    return options[h % len(options)]


def fit_pick(name, salt, options, lo, hi):
    """Deterministically pick a rendered string whose length lands in [lo, hi].

    Location names differ in length by 12+ characters, so a single fixed
    template cannot keep every page inside Google's snippet window. Callers
    hand in a pool of already-rendered candidates; we keep the ones that fit
    and hash-select from those, so pages stay varied, regenerable, and unique
    (every candidate embeds the location label).
    """
    ok = [o for o in options if lo <= len(o) <= hi]
    if ok:
        return pick(name, salt, ok)
    under = [o for o in options if len(o) <= hi]
    if under:
        best = max(len(o) for o in under)
        return pick(name, salt, [o for o in under if len(o) == best])
    best = min(len(o) for o in options)
    return pick(name, salt, [o for o in options if len(o) == best])


def pick_n(name, salt, options, n):
    """Deterministic rotated sample of n options preserving variety."""
    h = int(hashlib.md5((name + "|" + salt).encode("utf-8")).hexdigest(), 16)
    start = h % len(options)
    rot = options[start:] + options[:start]
    return rot[:n]


# ---------------------------------------------------------------------------
# TEMPLATE POOLS (>=4 variants per section)
# ---------------------------------------------------------------------------

# Search snippets: titles are held to 50-60 chars and descriptions to
# 140-155 so Google never truncates them mid-sentence. Location labels vary
# by 12+ characters, so each pool spans a range of lengths and fit_pick()
# selects a variant that lands in the window for that specific location.
# Prices are deliberately absent here: the site is pre-launch and the
# "planned pricing at launch" framing does not survive a 155-char snippet.
TITLE_CONCEPTS = [
    "AI Property Management",
    "AI Property Manager",
    "Property Management Software",
    "AI Property Management Platform",
    "AI Rental Management",
    "Property Management AI",
]

TITLE_TAGS = [
    "24/7 Tenant Answering",
    "Tenants Answered 24/7",
    "Repairs, Rent, Renewals",
    "For Landlords",
    "Rent and Repairs Handled",
    "Built for Landlords",
]

TITLE_MIN, TITLE_MAX = 50, 60
DESC_MIN, DESC_MAX = 140, 155


def title_candidates(loc):
    """Every candidate embeds `loc`, so titles stay unique across pages."""
    out = []
    for concept in TITLE_CONCEPTS:
        out.append("%s in %s | RentShepherd" % (concept, loc))
        out.append("%s for Landlords in %s | RentShepherd" % (concept, loc))
        for tag in TITLE_TAGS:
            out.append("%s in %s — %s | RentShepherd" % (concept, loc, tag))
    return out


DESCRIPTIONS = [
    "AI property management for {loc}: tenants answered 24/7, repairs triaged, rent collected, renewals prepped. Join the early access list.",
    "Manage {loc} rentals without the 2am calls. Tenants answered around the clock, repairs triaged, rent collected. Join the early access list.",
    "{loc} landlords: put an AI on the front line. Calls and texts answered 24/7, repairs triaged, rent collected, renewals prepped. Early access.",
    "RentShepherd is the AI property manager for {loc} — 24/7 tenant call and text answering, repair triage, rent collection and owner reports.",
    "An AI property manager for {loc} rentals: tenant calls and texts answered 24/7, work orders with photos, autopay rent, renewals prepped.",
    "AI property management in {loc}: tenants answered around the clock, repairs triaged, rent collected automatically, lease renewals prepped.",
    "For {loc} landlords and property managers: 24/7 tenant answering, repair triage with photos, autopay rent and owner reports. Early access.",
    "Self-manage {loc} rentals with an AI on call: tenants answered 24/7, repairs triaged, rent collected, renewals prepped. You approve everything.",
    "{loc} rentals, handled: tenant calls and texts answered 24/7, work orders raised with photos, rent auto-collected, renewals prepped for you.",
    "AI property management built for {loc} landlords. Tenants answered 24/7, repairs triaged, rent collected, renewals prepped, approvals yours.",
    "Put an AI on your {loc} rentals: 24/7 tenant answering, repair triage, automatic rent collection, lease renewals. Join the early access list.",
    "The AI property manager for {loc} landlords and property management companies: 24/7 tenant answering, repair triage, rent, renewals. Pre-launch.",
    "AI property management for {loc} landlords and property managers: tenants answered 24/7, repairs triaged, rent collected, renewals prepped.",
    "Every {loc} tenant call and text answered 24/7, every repair triaged with photos, rent collected automatically, renewals prepped. Early access.",
    "RentShepherd puts an AI property manager on your {loc} rentals: 24/7 tenant calls and texts, repair triage, rent collection and lease renewals.",
    "AI property management for {loc}: 24/7 tenant answering, repair triage with photos, automatic rent collection, owner reports. Join the early access list.",
]


def desc_candidates(loc):
    return [d.format(loc=loc) for d in DESCRIPTIONS]

EYEBROWS = [
    "Service area — {loc}",
    "Available across {loc}",
    "AI property management — {loc}",
    "For {loc} landlords and property managers",
]

H1S = [
    'AI property management in <span class="grad-text">{loc}</span>',
    'The AI property manager for <span class="grad-text">{loc}</span> rentals',
    '{loc} rentals, <span class="grad-text">answered around the clock</span>',
    'Your {loc} rentals, <span class="grad-text">covered at 2am</span>',
]

INTROS = [
    "RentShepherd is the all-in-one AI property management platform for {loc} landlords and property management companies. It answers tenant calls and texts 24/7, triages repairs into tracked work orders, collects rent automatically, and preps lease renewals — across {market}. You approve every decision with one tap; it handles the rest.",
    "From {market} — rentals in {loc} come in every shape, and RentShepherd covers them all from one secured dashboard. Tenant calls and texts are answered around the clock, repair requests arrive triaged with photos, rent collects itself, and lease renewals are prepped long before the deadline.",
    "Whether you rent out one house or run a property management company with buildings across {loc}, RentShepherd puts an AI on the front line: 24/7 call and text answering, repair triage, automatic rent payments, a renter portal tenants actually use, and owner reports worth reading.",
    "The rental market in {loc} spans {market}. RentShepherd is the AI property manager built to cover all of it — answering tenants day and night, turning repair complaints into tracked work orders with photos, chasing rent politely, and flagging every lease renewal months ahead.",
    "Managing rentals in {loc} shouldn't mean being on call at 2am. RentShepherd takes the front line — tenant calls and texts answered instantly, repairs triaged, rent tracked and auto-collected — across {market}, while every real decision still waits for your one-tap approval.",
]

WHY_HEADS_STATE = [
    "Why {loc} landlords hand the phone to RentShepherd",
    "Built for how renting works in {loc}",
    "From {c1} to {c2}: <span class=\"grad-text\">{loc}, covered</span>",
    "The {loc} rental market, <span class=\"grad-text\">minus the after-hours part</span>",
]

WHY_P1_STATE = [
    "In {c1}, {c2}, and {c3}, the story repeats: {market}. Every one of those tenants expects an answer the moment something breaks — and for most self-managing landlords, that answer is you, at every hour. RentShepherd changes the math. Tenants text or call one number and always reach a calm, capable assistant that logs the request, assesses urgency, and knows when to wake you and when to let you sleep.",
    "{loc} isn't one rental market — it's {market}. What an apartment in {c1} and a single-family home outside {c2} have in common is simpler: tenants who message at night, repairs that can't be diagnosed from a one-line text, and rent that occasionally needs chasing. RentShepherd puts the same tireless front line on all of it, from {c3} to the smallest town on your books.",
    "Own in {c1}? Manage a building in {c2}? Across {loc} the day-to-day is the same grind: {market} all generate the same stream of texts, calls, and small emergencies. RentShepherd answers every one instantly, sorts the urgent from the routine, and files the whole conversation where you can read it with your coffee instead of at midnight.",
    "Landlords in {c1}, {c2}, {c3}, and everywhere between deal with the same reality: {market} — and a phone that never quite goes quiet. RentShepherd takes that phone. Tenants get instant, competent answers around the clock; you get a clean log, a triaged repair queue, and approval cards for anything that actually needs you.",
]

WHY_P2_STATE = [
    "It works whether you live down the street or out of state. Remote owners with {loc} property get an assistant that is always on duty in the right time zone; property management companies get per-building routing, replies under their own name, and owner-ready reports for every client. RentShepherd is a cloud platform available anywhere in {loc} — nothing to install, no minimum portfolio, and setup takes about 15 minutes.",
    "Because RentShepherd is a cloud platform, it serves all of {loc} equally — big metro or small town, one door or three hundred. Self-managing landlords keep the control and skip the 8–10% of rent a traditional manager charges. Property management companies put it on the front line of every building and let their team focus on decisions instead of message-routing.",
    "There's no local office to wait on and none needed: RentShepherd works anywhere in {loc} from day one. Add your units, tenants, lease dates, and preferred local vendors, share the number with tenants, and the front line is live. You stay the decision-maker — every dispatch, renewal offer, and unusual situation still comes to you as a one-tap approval.",
    "For out-of-state owners, {loc} property no longer means missed calls across time zones — RentShepherd answers instantly and escalates only what matters. For local landlords, it means dinner without interruptions. And for property management companies, it means every building in the portfolio gets a 24/7 front line while replies go out under your company's name.",
]

WHY_HEADS_CITY = [
    "Why {loc} landlords hand the phone to RentShepherd",
    "Built for how renting works in {loc}",
    "From {n1} to {n2}: <span class=\"grad-text\">{loc}, covered</span>",
    "The {loc} rental market, <span class=\"grad-text\">minus the after-hours part</span>",
]

WHY_P1_CITY = [
    "From {n1} to {n2} to {n3}, renting in {loc} means {market}. Those tenants text at midnight, report leaks with one blurry photo, and expect paying rent to be as easy as everything else on their phone. RentShepherd gives every one of them an instant, competent answer — and gives you a searchable log of every word.",
    "{loc} isn't one rental market. {market_cap} — and each corner of it, whether that's {n1}, {n2}, or {n3}, produces the same stream of texts, calls, and small emergencies. RentShepherd answers all of it in seconds, sorts the urgent from the routine, and queues real decisions for your one-tap approval.",
    "A unit in {n1} and a house out toward {n2} generate the same work: {market}, plus the maintenance requests, rent questions, and lease deadlines that come with them. RentShepherd puts one tireless front line on your whole {loc} portfolio, so the only messages that reach you are the ones that need you.",
    "Whether your doors are in {n1}, {n2}, or {n3}, {loc} tenants expect fast answers — and {market} keep the requests coming at all hours. RentShepherd answers instantly, triages every repair, tracks every payment, and files every conversation, so your evenings belong to you again.",
]

WHY_P2_CITY = [
    "It works whether you live in {loc} or manage from another state entirely. Remote owners get an assistant that's always on duty; property management companies get per-building routing, replies under their own name, and owner-ready reports per client. RentShepherd is a cloud platform available everywhere in {loc} and across {state} — nothing to install, and setup takes about 15 minutes.",
    "Because RentShepherd is a cloud platform, it covers every {loc} zip code from day one — no local office needed, none claimed. Add your units, tenants, lease dates, and your own trusted {loc} vendors; share the number with tenants; the front line is live. Every dispatch and renewal offer still waits for your one-tap approval.",
    "Self-managing landlords in {loc} keep the control and skip the 8–10% of rent a traditional manager charges. Property management companies put RentShepherd on the front line of every building they run, from {n1} to {n2}, while their team handles only the decisions that matter. Either way, you hold the approvals.",
    "For the out-of-town owner with a rental in {loc}, RentShepherd means no more missed 2am calls from a different time zone. For the local landlord, it means the phone finally goes quiet. For property management companies across {state}, it means every tenant thread answered, triaged, and logged per building — around the clock.",
]

FEAT_HEADS = [
    "What RentShepherd handles for {loc} rentals",
    "The features {loc} landlords lean on most",
    "The day-to-day in {loc}, <span class=\"grad-text\">handled</span>",
    "Everything on autopilot, <span class=\"grad-text\">everything on the record</span>",
]

FEAT_SUBS = [
    "Real product features, applied to real {loc} scenarios — and anything that commits your money or your word waits for your one-tap approval.",
    "Every feature below runs 24/7 for {loc} landlords and property managers on the plans that include it.",
    "From the first tenant text to the monthly report — here's what RentShepherd takes off your plate in {loc}.",
    "One platform, one inbox, one dashboard — these are the jobs it does for {loc} portfolios every day.",
]

CLIMATE_LINE = {
    "cold": "A no-heat call on {art} {loc} winter night is treated as the emergency it is.",
    "hot": "An air-conditioning failure in the {loc} summer heat is treated as the emergency it is.",
    "mixed": "A burst pipe at 2am is treated as the emergency it is; a dripping tap waits for morning.",
}

# key: (titles, bodies) — bodies may use {loc}, {climate}, {ref}
FEATURES = {
    "answering": (
        ["Every call and text, answered 24/7", "Tenant calls and texts, covered around the clock"],
        ["Tenants across {loc} message or call one number and always get a real reply in seconds — questions answered, requests logged, urgency assessed. Calls are answered by a calm voice and transcribed into the same inbox, so you read the thread on your schedule, not theirs.",
         "One number for every tenant in your {loc} portfolio. Texts get instant, accurate replies; calls are answered, triaged, and transcribed. Nothing rings through to you at midnight unless it truly should."],
    ),
    "triage": (
        ["Repair triage that knows a real emergency", "Triage that knows a burst pipe from a dripping tap"],
        ["{climate} Genuine emergencies escalate to you immediately, with safety guidance already sent to the tenant. Everything else is logged, prioritized, and scheduled for a reasonable hour.",
         "{climate} RentShepherd's triage sorts every {loc} repair request the moment it arrives — urgent issues reach you with full context in minutes, routine ones queue quietly for morning."],
    ),
    "workorders": (
        ["Work orders with photos, start to finish", "A renter portal tenants actually use"],
        ["Your {loc} tenants get one link to pay rent, submit a work order with photos and video the moment something breaks, track it from reported to resolved, and check their lease. Fewer calls to you, everything on the record.",
         "Instead of a vague voicemail, you get a structured work order: photos, video, unit, and description, submitted through the renter portal and tracked to resolution. Your {loc} tenants see progress; you see everything."],
    ),
    "rent": (
        ["Automatic rent payments", "Rent that collects itself"],
        ["Tenants set autopay once and rent lands in your bank account through a licensed payment processor — RentShepherd never holds your funds. Late fees apply themselves, and you always see exactly who has paid across your {loc} portfolio.",
         "Autopay through the renter portal sends rent straight to your account on the first — no chasing, no awkward texts. Prefer your current setup? RentShepherd still tracks and flags every {loc} payment either way."],
    ),
    "renewals": (
        ["Lease renewals, never last-minute", "Renewals prepped months ahead"],
        ["90-, 60-, and 30-day renewal checkpoints with drafted tenant outreach, so notice periods never sneak past you — and good {loc} tenants get a renewal offer before they start browsing listings.",
         "Every lease in your {loc} portfolio sits on a renewal timeline. RentShepherd drafts the outreach at 90, 60, and 30 days out; you approve, edit, or hold each message with one tap."],
    ),
    "reports": (
        ["Owner reports you'll actually read", "A monthly report per property"],
        ["Rent collected, repairs opened and resolved, upcoming lease dates, every conversation summarized — one clean page per property per month. {ref}",
         "Each month, each {loc} property gets a one-page report: money in, issues fixed, leases coming due, conversations summarized. {ref}"],
    ),
    "dashboard": (
        ["One secured dashboard for the whole portfolio", "Your whole {loc} portfolio on one screen"],
        ["Every property, tenant thread, repair, payment, and lease date in one encrypted dashboard — one rental house or a hundred doors across {loc}. Reachable from any device, backed up always.",
         "Whether you hold one {loc} rental or manage whole buildings, everything lives on a single secured screen: tenants, threads, work orders, payments, leases. No spreadsheet stitching required."],
    ),
    "dispatch": (
        ["Vendor dispatch, drafted for you", "Dispatches ready for one tap"],
        ["When {art} {loc} repair needs a pro, a ready-to-send message to your own plumber or electrician is waiting — unit, issue, photos, access notes. You approve, edit, or hold it. RentShepherd never spends your money on its own.",
         "RentShepherd drafts the dispatch to your preferred local vendor the moment triage calls for one — full context included. It sends only after your one-tap approval, so your money and your word stay yours."],
    ),
}

REPORT_REF = {
    "state": "Property managers across {loc} can hand them straight to their owners.",
    "city": "{loc} property managers can hand them straight to their owners.",
}

PRICE_HEADS = [
    "Simple pricing for {loc} portfolios of any size",
    "Plans that scale from one door to whole buildings",
    "Pricing that beats the traditional 8–10% cut",
    "What RentShepherd costs in {loc}",
]

PRICE_INTROS = [
    "These are the plans we intend to launch with — RentShepherd is in early access and nothing is on sale yet. Prices in USD, the same in {loc} as everywhere else.",
    "Flat monthly pricing, not a percentage of your {loc} rents. These are the planned launch prices; RentShepherd is in early access and not yet open for sign-up.",
    "A plan for every size of {loc} portfolio, and you can change plan as you grow. These are planned launch prices, not yet purchasable: RentShepherd is in early access.",
    "No percentage of rent, no setup fee — one flat monthly price, planned for launch. RentShepherd is in early access today, so nothing can be bought yet.",
]

PRICE_NOTES = [
    "Compare: a traditional property manager charging 8–10% of rent costs a landlord collecting $6,000/mo between $480 and $600 — every month, with less of your say.",
    "A traditional manager taking 8–10% of collected rent often costs more per month than RentShepherd costs per year on Starter — and you give up the final word.",
    "Growth is the most popular plan: 24/7 call answering, the renter portal with automatic rent payments, repair triage with vendor dispatch drafts, and owner reports for $79/mo.",
    "Running more than 30 units, or managing buildings for clients? Enterprise adds per-building routing, team seats, and replies under your company's name — pricing built around your portfolio.",
]

CTA_HEADS = [
    "Get the 2am shift covered in {loc}",
    "Put an AI on the front line of your {loc} rentals",
    "Your {loc} tenants, answered tonight",
    "Ready when your {loc} phone rings next",
]

CTA_BODIES = [
    "Join the early access list and we'll email you as soon as access opens — and we'll only ever email you about RentShepherd.",
    "Get your {loc} units on the early access list. When access opens you share one number with tenants and RentShepherd takes the front line — you keep one-tap control.",
    "When your access opens, setup takes about 15 minutes: add units, tenants, lease dates, and your preferred vendors. From that moment, every tenant message gets answered — day or night.",
    "Joining the list costs nothing and commits you to nothing — no card, no account. We'll tell you when access opens for {loc} landlords.",
]

LINK_HEADS_STATE = [
    "RentShepherd near {loc}",
    "Explore more locations",
    "More places RentShepherd covers",
    "Keep exploring the map",
]

TIERS_HTML = """
        <ul class="tier-lines">
          <li><span><strong>Starter</strong> — up to 3 units</span><span class="tier-amt">$29/mo</span></li>
          <li><span><strong>Growth</strong> — up to 12 units <em class="tier-pop">Most popular</em></span><span class="tier-amt">$79/mo</span></li>
          <li><span><strong>Portfolio</strong> — up to 30 units</span><span class="tier-amt">$149/mo</span></li>
          <li><span><strong>Enterprise</strong> — unlimited units for property management companies and large portfolios</span><span class="tier-amt">Custom</span></li>
        </ul>"""

INLINE_CSS = """
    .crumbs{font-size:.85rem;color:var(--muted);display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1.2rem}
    .crumbs a{color:var(--muted)}
    .crumbs a:hover{color:var(--emerald)}
    .crumbs .sep{color:var(--faint)}
    .loc-hero{padding:7.2rem 0 .5rem;max-width:860px}
    .loc-hero h1{font-size:clamp(2rem,4.6vw,3.1rem);margin:.65rem 0 1rem}
    .loc-hero .lede{color:var(--muted);font-size:1.08rem;max-width:70ch}
    .loc-section{padding:3.2rem 0}
    .loc-section h2{font-size:clamp(1.45rem,3vw,2rem);margin-bottom:1rem}
    .loc-prose p{color:var(--muted);max-width:74ch;margin-bottom:1rem}
    .tier-lines{list-style:none;padding:0;margin:1.3rem 0;display:grid;gap:.75rem}
    .tier-lines li{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap;border-bottom:1px dashed var(--border);padding-bottom:.75rem;color:var(--muted)}
    .tier-lines strong{color:var(--text)}
    .tier-amt{font-family:var(--font-head);font-weight:700;color:var(--emerald);white-space:nowrap}
    .tier-pop{font-style:normal;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--teal);border:1px solid var(--border-strong);border-radius:999px;padding:.1rem .55rem;margin-left:.5rem}
    .price-ctas{display:flex;gap:.8rem;flex-wrap:wrap;margin-top:1.2rem}
    .link-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(185px,1fr));gap:.6rem;margin:.9rem 0 0}
    .link-grid a{display:block;padding:.62rem .9rem;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--muted);font-size:.92rem}
    .link-grid a:hover{color:var(--text);border-color:var(--border-strong)}
    .loc-links h3{font-size:1.02rem;margin:1.6rem 0 .2rem}
    .hub-region h2{margin-top:2.4rem}
"""

# ---------------------------------------------------------------------------
# PAGE SHELL (nav + footer copied from index.html, links adjusted for /locations/)
# ---------------------------------------------------------------------------

# Analytics is wired but inert until a real GA4 id replaces the placeholder.
ANALYTICS = (
    '  <!-- Analytics: paste your GA4 Measurement ID below to activate. '
    'Until then this is a no-op. -->\n'
    '  <script>window.GA_ID="G-XXXXXXXXXX";'
    'if(window.GA_ID&&!/^G-X+$/.test(window.GA_ID))'
    "{var s=document.createElement('script');s.async=1;"
    "s.src='https://www.googletagmanager.com/gtag/js?id='+window.GA_ID;"
    'document.head.appendChild(s);window.dataLayer=window.dataLayer||[];'
    'function gtag(){dataLayer.push(arguments);}'
    "gtag('js',new Date());gtag('config',window.GA_ID);}</script>"
)

FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='10' fill='%23071009'/%3E%3Cpath d='M24 7 41 20v19a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V20Z' fill='none' stroke='%2334d399' stroke-width='3' stroke-linejoin='round'/%3E%3Cpath d='M20 35V20a5 5 0 0 1 10 0v2.5' fill='none' stroke='%232dd4bf' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E"


def page_shell(title, description, canonical, jsonld, main_html):
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <meta name="description" content="{description}">
  <link rel="canonical" href="{canonical}">
  <meta name="theme-color" content="#040a07">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="{canonical}">
  <meta property="og:site_name" content="RentShepherd">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{description}">
  <meta property="og:image" content="https://rentshepherd.com/images/og-default.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{description}">
  <meta name="twitter:image" content="https://rentshepherd.com/images/og-default.png">

  <link rel="icon" type="image/svg+xml" href="{favicon}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

  <link rel="stylesheet" href="../css/style.css">
  <style>{inline_css}  </style>

  <script type="application/ld+json">
{jsonld}
  </script>

{analytics}
</head>
<body>

  <!-- Aurora background -->
  <div class="aurora" aria-hidden="true">
    <div class="aurora-blob aurora-emerald"></div>
    <div class="aurora-blob aurora-teal"></div>
    <div class="aurora-blob aurora-sea"></div>
  </div>
  <div class="noise-overlay" aria-hidden="true"></div>

  <!-- ============ NAV ============ -->
  <header class="site-nav" id="top">
    <div class="nav-inner container">
      <a class="brand" href="/" aria-label="RentShepherd home">
        <svg class="brand-mark" viewBox="0 0 48 48" width="34" height="34" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="mark-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#34d399"/>
              <stop offset="1" stop-color="#2dd4bf"/>
            </linearGradient>
          </defs>
          <path d="M24 6 42.5 20v19.5a3 3 0 0 1-3 3h-31a3 3 0 0 1-3-3V20Z" fill="none" stroke="url(#mark-grad)" stroke-width="2.6" stroke-linejoin="round"/>
          <path d="M19.5 35.5V19.5a6 6 0 0 1 12 0v3" fill="none" stroke="url(#mark-grad)" stroke-width="2.6" stroke-linecap="round"/>
        </svg>
        <span class="brand-name">Rent<em>Shepherd</em></span>
      </a>

      <nav class="nav-links" id="nav-links" aria-label="Primary">
        <a href="/#features">Features</a>
        <a href="/#how-it-works">How it works</a>
        <a href="/#pricing">Pricing</a>
        <a href="/#faq">FAQ</a>
        <a class="btn btn-primary btn-nav" href="/#waitlist">Get early access</a>
      </nav>

      <button class="nav-toggle" id="nav-toggle" aria-expanded="false" aria-controls="nav-links" aria-label="Open menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>

  <main>
{main_html}
  </main>

  <!-- ============ FOOTER ============ -->
  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <a class="brand" href="/" aria-label="RentShepherd home">
          <svg class="brand-mark" viewBox="0 0 48 48" width="30" height="30" aria-hidden="true" focusable="false">
            <path d="M24 6 42.5 20v19.5a3 3 0 0 1-3 3h-31a3 3 0 0 1-3-3V20Z" fill="none" stroke="#34d399" stroke-width="2.6" stroke-linejoin="round"/>
            <path d="M19.5 35.5V19.5a6 6 0 0 1 12 0v3" fill="none" stroke="#2dd4bf" stroke-width="2.6" stroke-linecap="round"/>
          </svg>
          <span class="brand-name">Rent<em>Shepherd</em></span>
        </a>
        <p class="footer-tag">The AI property manager for landlords and property management companies — one rental house to whole portfolios. It does the 2am part — you keep the control.</p>
      </div>

      <nav class="footer-col" aria-label="Product">
        <h3>Product</h3>
        <a href="/#features">Features</a>
        <a href="/#how-it-works">How it works</a>
        <a href="/#use-cases">Who it&rsquo;s for</a>
        <a href="/#pricing">Pricing</a>
      </nav>

      <nav class="footer-col" aria-label="Get started">
        <h3>Get started</h3>
        <a href="/#faq">FAQ</a>
        <a href="/#waitlist">Early access</a>
        <a href="index.html">All locations</a>
        <a href="mailto:leads@stylemarking.com">Contact us</a>
      </nav>
    </div>

    <div class="container footer-legal">
      <p>&copy; 2026 RentShepherd. All rights reserved.</p>
      <p><a href="/privacy">Privacy</a> &middot; <a href="/terms">Terms</a> &middot; <a href="mailto:leads@stylemarking.com">leads@stylemarking.com</a></p>
      <p>Designed &amp; Built by <a href="https://stylemarking.com" rel="noopener">StyleMarking.com</a></p>
    </div>
  </footer>

  <script src="../js/main.js" defer></script>
</body>
</html>
""".format(title=esc(title), description=esc(description), canonical=canonical,
           favicon=FAVICON, inline_css=INLINE_CSS, jsonld=jsonld, main_html=main_html,
           analytics=ANALYTICS)


def esc(s):
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")


def jsonld_for(loc_name, kind, canonical, description, state_name=None):
    if kind == "city":
        area = {"@type": "City", "name": loc_name,
                "containedInPlace": {"@type": "State", "name": state_name}}
        crumb_name = "%s, %s" % (loc_name, state_name)
    else:
        area = {"@type": "State", "name": loc_name}
        crumb_name = loc_name
    graph = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Locations", "item": DOMAIN + "/locations/"},
                    {"@type": "ListItem", "position": 3, "name": crumb_name, "item": canonical},
                ],
            },
            {
                "@type": "Service",
                "name": "AI Property Management in %s" % crumb_name,
                "serviceType": "AI property management software",
                "url": canonical,
                "description": description,
                "provider": {
                    "@type": "Organization",
                    "@id": DOMAIN + "/#org",
                    "name": "RentShepherd",
                    "url": DOMAIN + "/",
                },
                "areaServed": area,
                "offers": {
                    "@type": "AggregateOffer",
                    "priceCurrency": "USD",
                    "lowPrice": "29",
                    "highPrice": "149",
                    "offerCount": "3",
                    "availability": "https://schema.org/PreOrder",
                },
            },
        ],
    }
    return json.dumps(graph, indent=2)


def crumbs_html(loc_label):
    return ('<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a>'
            '<span class="sep">/</span><a href="index.html">Locations</a>'
            '<span class="sep">/</span><span aria-current="page">%s</span></nav>' % loc_label)


def features_html(name, loc, climate, kind, extra_city=None):
    """Pick 5 feature cards deterministically; always include answering + triage."""
    keys = ["workorders", "rent", "renewals", "reports", "dashboard", "dispatch"]
    chosen = ["answering", "triage"] + pick_n(name, "featpick", keys, 3)
    # rotate presentation order
    h = int(hashlib.md5((name + "|featorder").encode()).hexdigest(), 16)
    start = h % len(chosen)
    chosen = chosen[start:] + chosen[:start]

    cards = []
    for i, key in enumerate(chosen):
        titles, bodies = FEATURES[key]
        art = article(loc)
        t = pick(name, "ft-" + key, titles).format(loc=loc, art=art)
        ref = REPORT_REF[kind].format(loc=loc)
        b = pick(name, "fb-" + key, bodies).format(
            loc=loc, art=art, ref=ref,
            climate=CLIMATE_LINE[climate].format(loc=loc, art=art))
        cards.append(
            '        <div class="glass-card use-case reveal">\n'
            '          <h3>%s</h3>\n'
            '          <p>%s</p>\n'
            '        </div>' % (t, b))
    head = pick(name, "feathead", FEAT_HEADS).format(loc=loc)
    sub = pick(name, "featsub", FEAT_SUBS).format(loc=loc)
    return ('    <section class="loc-section container">\n'
            '      <div class="section-head reveal">\n'
            '        <p class="eyebrow">Features</p>\n'
            '        <h2>%s</h2>\n'
            '        <p class="section-sub">%s</p>\n'
            '      </div>\n'
            '      <div class="use-cases" data-stagger>\n%s\n      </div>\n'
            '    </section>' % (head, sub, "\n".join(cards)))


def pricing_html(name, loc):
    head = pick(name, "phead", PRICE_HEADS).format(loc=loc)
    intro = pick(name, "pintro", PRICE_INTROS).format(loc=loc)
    note = pick(name, "pnote", PRICE_NOTES).format(loc=loc)
    return ('    <section class="loc-section container section-narrow">\n'
            '      <div class="glass-card cta-card reveal loc-prose">\n'
            '        <p class="eyebrow">Planned pricing at launch</p>\n'
            '        <h2>%s</h2>\n'
            '        <p>%s</p>\n%s\n'
            '        <p>%s</p>\n'
            '        <div class="price-ctas">\n'
            '          <a class="btn btn-primary btn-lg" href="/#waitlist">Join the early access list</a>\n'
            '          <a class="btn btn-ghost btn-lg" href="/#pricing">See full pricing</a>\n'
            '        </div>\n'
            '      </div>\n'
            '    </section>' % (head, intro, TIERS_HTML, note))


def cta_html(name, loc):
    head = pick(name, "ctahead", CTA_HEADS).format(loc=loc)
    body = pick(name, "ctabody", CTA_BODIES).format(loc=loc)
    return ('    <section class="loc-section container section-narrow">\n'
            '      <div class="section-head reveal">\n'
            '        <h2>%s</h2>\n'
            '        <p class="section-sub">%s</p>\n'
            '        <p style="margin-top:1.3rem"><a class="btn btn-primary btn-lg" href="/#waitlist">Join the early access list</a></p>\n'
            '      </div>\n'
            '    </section>' % (head, body))


def link_grid(links):
    return '<div class="link-grid">%s</div>' % "".join(
        '<a href="%s">%s</a>' % (href, esc(label)) for label, href in links)


def build_state_page(state):
    name, abbr, majors, neighbors, climate, market = state
    slug = STATE_SLUG[name]
    canonical = "%s/locations/%s" % (DOMAIN, slug)
    title = fit_pick(name, "title", title_candidates(name), TITLE_MIN, TITLE_MAX)
    desc = fit_pick(name, "desc", desc_candidates(name), DESC_MIN, DESC_MAX)
    c1, c2, c3 = majors[0], majors[1], majors[2]

    eyebrow = pick(name, "eyebrow", EYEBROWS).format(loc=name)
    h1 = pick(name, "h1", H1S).format(loc=name)
    intro = pick(name, "intro", INTROS).format(loc=name, market=market)

    why_head = pick(name, "whyhead", WHY_HEADS_STATE).format(loc=name, c1=c1, c2=c2)
    why_p1 = pick(name, "whyp1", WHY_P1_STATE).format(loc=name, market=market, c1=c1, c2=c2, c3=c3)
    why_p2 = pick(name, "whyp2", WHY_P2_STATE).format(loc=name)

    # internal links: cities in our list for this state + 4 nearby states
    own_cities = CITIES_BY_STATE.get(name, [])
    blocks = []
    if own_cities:
        city_links = [("%s, %s" % (c[0], c[1]), CITY_SLUG[(c[0], c[1])] + ".html") for c in own_cities]
        blocks.append('        <h3>RentShepherd in %s cities</h3>\n        %s'
                      % (name, link_grid(city_links)))
    nb_links = [(n, STATE_SLUG[n] + ".html") for n in neighbors]
    blocks.append('        <h3>Nearby states</h3>\n        %s' % link_grid(nb_links))
    blocks.append('        <h3>Everywhere else</h3>\n        %s'
                  % link_grid([("All locations", "index.html")]))
    links_head = pick(name, "linkshead", LINK_HEADS_STATE).format(loc=name)

    main_html = "\n\n".join([
        '    <section class="loc-hero container">\n'
        '      %s\n'
        '      <p class="eyebrow reveal"><span class="pulse-dot" aria-hidden="true"></span> %s</p>\n'
        '      <h1 class="reveal">%s</h1>\n'
        '      <p class="lede reveal">%s</p>\n'
        '    </section>' % (crumbs_html(name), eyebrow, h1, intro),
        '    <section class="loc-section container loc-prose">\n'
        '      <div class="section-head reveal" style="text-align:left;margin:0 0 1rem">\n'
        '        <h2>%s</h2>\n'
        '      </div>\n'
        '      <p class="reveal">%s</p>\n'
        '      <p class="reveal">%s</p>\n'
        '    </section>' % (why_head, why_p1, why_p2),
        features_html(name, name, climate, "state"),
        pricing_html(name, name),
        cta_html(name, name),
        '    <section class="loc-section container loc-links">\n'
        '      <div class="section-head reveal" style="text-align:left;margin:0">\n'
        '        <h2>%s</h2>\n'
        '      </div>\n%s\n'
        '    </section>' % (links_head, "\n".join(blocks)),
    ])

    jsonld = jsonld_for(name, "state", canonical, desc)
    return slug + ".html", page_shell(title, desc, canonical, jsonld, main_html)


def build_city_page(city):
    name, abbr, state_name, hoods, climate, market = city
    key = "%s|%s" % (name, abbr)  # hash key unique per city (Rochester MN vs NY etc.)
    slug = CITY_SLUG[(name, abbr)]
    loc = name
    label = "%s, %s" % (name, abbr)
    canonical = "%s/locations/%s" % (DOMAIN, slug)
    title = fit_pick(key, "title", title_candidates(label), TITLE_MIN, TITLE_MAX)
    desc = fit_pick(key, "desc", desc_candidates(label), DESC_MIN, DESC_MAX)
    n1, n2, n3 = hoods[0], hoods[1], hoods[2]

    eyebrow = pick(key, "eyebrow", EYEBROWS).format(loc=label)
    h1 = pick(key, "h1", H1S).format(loc=loc)
    intro = pick(key, "intro", INTROS).format(loc=loc, market=market)

    why_head = pick(key, "whyhead", WHY_HEADS_CITY).format(loc=loc, n1=n1, n2=n2)
    market_cap = market[0].upper() + market[1:]
    why_p1 = pick(key, "whyp1", WHY_P1_CITY).format(
        loc=loc, market=market, market_cap=market_cap, n1=n1, n2=n2, n3=n3)
    why_p2 = pick(key, "whyp2", WHY_P2_CITY).format(loc=loc, state=state_name, n1=n1, n2=n2)

    # internal links: own state + 5 other cities + hub
    others = [c for c in CITIES if not (c[0] == name and c[1] == abbr)]
    other_five = pick_n(key, "citylinks", others, 5)
    blocks = [
        '        <h3>More %s coverage</h3>\n        %s' % (
            state_name,
            link_grid([("%s — statewide" % state_name, STATE_SLUG[state_name] + ".html")])),
        '        <h3>Other rental markets</h3>\n        %s' % link_grid(
            [("%s, %s" % (c[0], c[1]), CITY_SLUG[(c[0], c[1])] + ".html") for c in other_five]),
        '        <h3>Everywhere else</h3>\n        %s' % link_grid(
            [("All locations", "index.html")]),
    ]
    links_head = pick(key, "linkshead", LINK_HEADS_STATE).format(loc=loc)

    main_html = "\n\n".join([
        '    <section class="loc-hero container">\n'
        '      %s\n'
        '      <p class="eyebrow reveal"><span class="pulse-dot" aria-hidden="true"></span> %s</p>\n'
        '      <h1 class="reveal">%s</h1>\n'
        '      <p class="lede reveal">%s</p>\n'
        '    </section>' % (crumbs_html(label), eyebrow, h1, intro),
        '    <section class="loc-section container loc-prose">\n'
        '      <div class="section-head reveal" style="text-align:left;margin:0 0 1rem">\n'
        '        <h2>%s</h2>\n'
        '      </div>\n'
        '      <p class="reveal">%s</p>\n'
        '      <p class="reveal">%s</p>\n'
        '    </section>' % (why_head, why_p1, why_p2),
        features_html(key, loc, climate, "city"),
        pricing_html(key, loc),
        cta_html(key, loc),
        '    <section class="loc-section container loc-links">\n'
        '      <div class="section-head reveal" style="text-align:left;margin:0">\n'
        '        <h2>%s</h2>\n'
        '      </div>\n%s\n'
        '    </section>' % (links_head, "\n".join(blocks)),
    ])

    jsonld = jsonld_for(name, "city", canonical, desc, state_name=state_name)
    return slug + ".html", page_shell(title, desc, canonical, jsonld, main_html)


REGIONS = [
    ("Midwest", ["Illinois", "Indiana", "Iowa", "Kansas", "Michigan", "Minnesota", "Missouri",
                 "Nebraska", "North Dakota", "Ohio", "South Dakota", "Wisconsin"]),
    ("South", ["Alabama", "Arkansas", "Delaware", "Florida", "Georgia", "Kentucky", "Louisiana",
               "Maryland", "Mississippi", "North Carolina", "Oklahoma", "South Carolina",
               "Tennessee", "Texas", "Virginia", "West Virginia"]),
    ("Northeast", ["Connecticut", "Maine", "Massachusetts", "New Hampshire", "New Jersey",
                   "New York", "Pennsylvania", "Rhode Island", "Vermont"]),
    ("West", ["Alaska", "Arizona", "California", "Colorado", "Hawaii", "Idaho", "Montana",
              "Nevada", "New Mexico", "Oregon", "Utah", "Washington", "Wyoming"]),
]


def build_hub():
    canonical = DOMAIN + "/locations/"
    title = "AI Property Management by State and Metro | RentShepherd"
    desc = ("Where RentShepherd works: AI property management for landlords in all 50 states "
            "and major rental markets. Tenants answered 24/7, repairs triaged.")

    city_links = [("%s, %s" % (c[0], c[1]), CITY_SLUG[(c[0], c[1])] + ".html") for c in CITIES]
    region_blocks = []
    for region, names in REGIONS:
        links = [(n, STATE_SLUG[n] + ".html") for n in sorted(names)]
        region_blocks.append(
            '      <div class="hub-region reveal">\n'
            '        <h2>%s</h2>\n        %s\n      </div>' % (region, link_grid(links)))

    main_html = """    <section class="loc-hero container">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span class="sep">/</span><span aria-current="page">Locations</span></nav>
      <p class="eyebrow reveal"><span class="pulse-dot" aria-hidden="true"></span> Service areas</p>
      <h1 class="reveal">AI property management, <span class="grad-text">wherever your rentals are</span></h1>
      <p class="lede reveal">RentShepherd is a cloud platform — it answers tenant calls and texts 24/7, triages repairs, collects rent automatically, and preps lease renewals for landlords and property management companies in every US state. Pick your market below to see how it fits the way renting works where your doors are.</p>
    </section>

    <section class="loc-section container loc-links">
      <div class="section-head reveal" style="text-align:left;margin:0 0 .4rem">
        <h2>Major rental markets</h2>
        <p class="section-sub">Deep dives for 25 of the biggest apartment and rental-investment metros we serve.</p>
      </div>
      {cities}
    </section>

    <section class="loc-section container loc-links">
      <div class="section-head reveal" style="text-align:left;margin:0 0 .4rem">
        <h2>All 50 states</h2>
        <p class="section-sub">One rental house or a whole portfolio of buildings — RentShepherd covers every state, no local office required.</p>
      </div>
{regions}
    </section>

    <section class="loc-section container section-narrow">
      <div class="glass-card cta-card reveal loc-prose">
        <p class="eyebrow">Planned pricing at launch</p>
        <h2>Same platform, same pricing, everywhere</h2>
        <p>Starter $29/mo (up to 3 units) &middot; Growth $79/mo (up to 12 units, most popular) &middot; Portfolio $149/mo (up to 30 units) &middot; Enterprise custom (unlimited units for property management companies). RentShepherd is in early access — these are the prices we plan to launch with, and nothing is on sale yet.</p>
        <div class="price-ctas">
          <a class="btn btn-primary btn-lg" href="/#waitlist">Join the early access list</a>
          <a class="btn btn-ghost btn-lg" href="/#pricing">See full pricing</a>
        </div>
      </div>
    </section>""".format(cities=link_grid(city_links), regions="\n".join(region_blocks))

    graph = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Locations", "item": canonical},
                ],
            },
            {
                "@type": "CollectionPage",
                "name": "RentShepherd Locations",
                "url": canonical,
                "description": desc,
                "isPartOf": {"@type": "WebSite", "name": "RentShepherd", "url": DOMAIN + "/"},
            },
            {
                "@type": "Service",
                "name": "AI Property Management",
                "serviceType": "AI property management software",
                "url": canonical,
                "provider": {"@type": "Organization", "@id": DOMAIN + "/#org",
                             "name": "RentShepherd", "url": DOMAIN + "/"},
                "areaServed": {"@type": "Country", "name": "United States"},
            },
        ],
    }
    return "index.html", page_shell(title, desc, canonical, json.dumps(graph, indent=2), main_html)


BLOG_LASTMOD = "2026-08-27"
BLOG_SLUGS = [
    "how-much-does-a-property-manager-cost",
    "small-landlord-self-management-system",
    "tenant-emergency-at-2am",
]


def build_sitemap(slugs):
    urls = [DOMAIN + "/", DOMAIN + "/blog/"]
    legal = [DOMAIN + "/privacy", DOMAIN + "/terms"]
    urls += [DOMAIN + "/blog/" + s for s in BLOG_SLUGS]
    urls += [DOMAIN + "/locations/"]
    urls += [DOMAIN + "/locations/" + s for s in slugs]
    urls += legal
    rows = []
    for u in urls:
        if u == DOMAIN + "/":
            prio = "1.0"
        elif u in legal:
            prio = "0.3"
        elif u.endswith("/locations/") or u.endswith("/blog/"):
            prio = "0.8"
        else:
            prio = "0.7"
        lastmod = BLOG_LASTMOD if "/blog/" in u else TODAY
        rows.append("  <url>\n    <loc>%s</loc>\n    <lastmod>%s</lastmod>\n"
                    "    <changefreq>monthly</changefreq>\n    <priority>%s</priority>\n  </url>"
                    % (u, lastmod, prio))
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + "\n".join(rows) + "\n</urlset>\n")


ROBOTS = """User-agent: *
Allow: /

Sitemap: https://rentshepherd.com/sitemap.xml
"""


# ---------------------------------------------------------------------------
# VALIDATION
# ---------------------------------------------------------------------------

class Auditor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.h1 = 0
        self.links = []
        self.jsonld = []
        self._in_ld = False
        self._ld_buf = []
        self._main_depth = 0
        self._words = 0

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "h1":
            self.h1 += 1
        if tag == "a" and d.get("href"):
            self.links.append(d["href"])
        if tag == "script" and d.get("type") == "application/ld+json":
            self._in_ld = True
            self._ld_buf = []
        if tag == "main":
            self._main_depth += 1

    def handle_endtag(self, tag):
        if tag == "script" and self._in_ld:
            self._in_ld = False
            self.jsonld.append("".join(self._ld_buf))
        if tag == "main" and self._main_depth:
            self._main_depth -= 1

    def handle_data(self, data):
        if self._in_ld:
            self._ld_buf.append(data)
        elif self._main_depth:
            self._words += len(data.split())


def validate():
    errors = []
    word_counts = {}
    pages = sorted(f for f in os.listdir(LOC_DIR) if f.endswith(".html"))
    for fname in pages:
        path = os.path.join(LOC_DIR, fname)
        with open(path, encoding="utf-8") as fh:
            html = fh.read()
        a = Auditor()
        a.feed(html)
        a.close()
        if a.h1 != 1:
            errors.append("%s: %d h1 tags (want exactly 1)" % (fname, a.h1))
        if not a.jsonld:
            errors.append("%s: no JSON-LD block" % fname)
        for blob in a.jsonld:
            try:
                json.loads(blob)
            except ValueError as e:
                errors.append("%s: invalid JSON-LD (%s)" % (fname, e))
        word_counts[fname] = a._words
        for href in a.links:
            if href.startswith(("http://", "https://", "mailto:", "#", "data:")):
                continue
            target = href.split("#", 1)[0].split("?", 1)[0]
            if not target:
                continue  # pure fragment
            if target.startswith("/"):
                rel = target.lstrip("/")
                fs = os.path.join(ROOT, rel) if rel else os.path.join(ROOT, "index.html")
            else:
                fs = os.path.normpath(os.path.join(LOC_DIR, target))
            if os.path.isdir(fs):
                fs = os.path.join(fs, "index.html")
            # Netlify serves extensionless "pretty URLs" (/privacy -> privacy.html).
            if not os.path.isfile(fs) and not os.path.isfile(fs + ".html"):
                errors.append("%s: broken internal link -> %s" % (fname, href))
    return errors, word_counts, pages


def main():
    validate_only = "--validate" in sys.argv
    if not validate_only:
        os.makedirs(LOC_DIR, exist_ok=True)
        written = []
        slugs = []
        for state in STATES:
            fname, html = build_state_page(state)
            with open(os.path.join(LOC_DIR, fname), "w", encoding="utf-8") as fh:
                fh.write(html)
            written.append(fname)
            slugs.append(fname[:-5])
        for city in CITIES:
            fname, html = build_city_page(city)
            with open(os.path.join(LOC_DIR, fname), "w", encoding="utf-8") as fh:
                fh.write(html)
            written.append(fname)
            slugs.append(fname[:-5])
        fname, html = build_hub()
        with open(os.path.join(LOC_DIR, fname), "w", encoding="utf-8") as fh:
            fh.write(html)
        written.append(fname)
        with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8") as fh:
            fh.write(build_sitemap(sorted(slugs)))
        with open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8") as fh:
            fh.write(ROBOTS)
        print("Generated %d pages in locations/ + sitemap.xml + robots.txt" % len(written))

    errors, word_counts, pages = validate()
    loc_pages = {k: v for k, v in word_counts.items() if k != "index.html"}
    if loc_pages:
        lo = min(loc_pages, key=loc_pages.get)
        hi = max(loc_pages, key=loc_pages.get)
        print("Validated %d pages. Location-page word counts: min %d (%s), max %d (%s)"
              % (len(pages), loc_pages[lo], lo, loc_pages[hi], hi))
    if errors:
        print("VALIDATION FAILED:")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    print("Validation clean: 1 h1/page, JSON-LD parses, all internal links resolve.")


if __name__ == "__main__":
    main()
