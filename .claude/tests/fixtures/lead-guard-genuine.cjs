// Genuine leads a 10-agent review wrote on 2026-10-25 for the four kinds of
// business (hm real estate, hh party rental, ru remodeler, sm agency). Every one
// is a real customer: lead-guard.test.cjs asserts none is ever dropped.
'use strict';
const D = { email: 'pat.lead@gmail.com', phone: '320-555-2671', name: 'Pat Olson' };
// biz: hm = Home Match (real estate), hh = Hitch & Host (party rental), ru = remodeler, sm = marketing agency
const C = [];
const add = (biz, message, o = {}) => C.push({ biz, message, ...o });

// --- short messages
['Call me', 'Interested!', 'Congratulations!', 'Price?', 'Is it still available?', 'Still available?', 'Call me please',
 'Text me', 'Yes', 'Interested.', 'Interested!!', 'Interested!!!', 'Please call', 'Thanks!', 'Available Saturday?',
 'How much?', 'Info please', 'Need a quote', 'Call after 5', 'ASAP please', 'Pricing?', 'Showing?', 'Is this pending?',
 'Callme', 'Pleasecallme', 'Thankyouverymuch', 'Congratulations', 'Interested!!!!!'].forEach((m) => add('hm', m));

// --- buyers / sellers / renters (Home Match)
[
  'We are relocating from Des Moines and want a lake home near Lake Le Homme Dieu.',
  'Looking at homes in Osakis or Melrose, 3 bed, under 350k.',
  'Hi Janet, we saw the listing on Zillow and would love to see it Saturday.',
  'My husband and I are retiring to Alexandria. Do you have anything on Lake Carlos?',
  'Is the cabin on Lake Miltona still for sale? We could come up this weekend.',
  'I want to sell my house in Sauk Centre next spring. What would it list for?',
  'Moving from Los Angeles. Need 4 bedrooms and a big yard.',
  'Relocating from Las Vegas to St. Cloud for work in January.',
  'We are a same-sex couple relocating from Chicago and want a welcoming neighborhood.',
  'I work at Grand Casino Mille Lacs and am looking for a house near Onamia.',
  'I work at Mystic Lake Casino, looking for a hobby farm within an hour.',
  'Looking for land with RV hookups or at least an electric hookup.',
  'Does the lot have a septic hookup or would we need a new system?',
  'Pre-approved with Bremer. I have a loan offer from my credit union too.',
  'Can I buy with bitcoin? I hold some crypto from my old job.',
  'Is there a time slot open for a showing Saturday morning?',
  'What showing slots do you have this weekend?',
  'We are betting on the market cooling off, but want to look now.',
  'Is the basement finished? The photos show nude colored walls.',
  'Our daughter is starting at UW Madison so we want a place on the way.',
  'Chicago IL buyer. Call after 6 EST.',
  'Call after 5 pm EST please, I am in New York.',
  'Moving from Hong Kong, need a home near good schools.',
  'Hola! Looking for a 3 bedroom house near St. Cloud.',
  'Xin chao, I want to buy a house in Willmar.',
  'Salaam, my family is looking for a 4 bedroom rental in St. Cloud.',
  'Nyob zoo, we are looking for a starter home in St. Paul or St. Cloud.',
  'Hej from Sweden! We are moving back to Minnesota next year.',
  'Guten Tag, we would like to see the farm near Freeport.',
  'Bonjour Janet, we are moving from Montreal to Alexandria.',
  'Here is the one we like https://www.zillow.com/homedetails/123-Lake-St-Alexandria-MN-56308/12345_zpid/',
  'Can we see these two? https://www.zillow.com/homedetails/1/1_zpid/ and https://www.zillow.com/homedetails/2/2_zpid/',
  'https://www.zillow.com/homedetails/123-Lake-St-Alexandria-MN-56308/12345_zpid/',
  'https://www.realtor.com/realestateandhomes-detail/123-Lake-St_Alexandria_MN_56308_M12345-67890',
  'This one on realtor.com: https://www.realtor.com/realestateandhomes-detail/123-Main-St_Osakis_MN',
  'Pin for the lake lot we want: https://maps.app.goo.gl/AbCdEf12345',
  'Photos of our house: https://photos.app.goo.gl/XyZ123abc',
  'Photos: https://www.icloud.com/photos/#0aBcDeFgHiJkLmNoPqRsTuVw',
  'My builder is at www.lakesidehomes.biz if you want to check them out.',
  'Our current home is listed by owner at www.olsonfamily.site, we need to buy before selling.',
  'Message me on WhatsApp wa.me/447911123456, I am in London until June.',
  'Text me on Telegram t.me/annak if easier, I am overseas.',
  'Hi I want to know your price',
  'I wanted to know your price.',
  'Interested in the Lake Ida listing. My email is jen@lakesideinn.live',
  'Is the Gamble property on Lake Mary still for sale?',
  'Need a rental for 6 months. My dog is a hookup mix lol, very friendly',
  'We want a house with a separate guest post-and-beam cabin.',
  'I need help understanding sex offender registry near the home',
  'Gender reveal: we just found out the sex of our 3rd baby so we need a bigger house!',
  'House hunting.Top priority is a three car garage.',
  'Looking for a home near the casino in Hinckley',
  'We sold our place in Fargo.Click the link I sent for our list.',
  'Interested in your listing. Free this week. Please call.',
  'Please call. Interested in the Osakis listing. Thanks.',
].forEach((m) => add('hm', m));

// dealbreakers free text (HM 'text' field)
add('hm', 'Interested in lake homes', { text: 'No HOA, no busy road, no casino traffic' });
add('hm', '', { text: 'Must have RV hookup' });
add('hm', '', { text: 'No gambling boats nearby lol' });

// --- party rentals (Hitch & Host)
[
  'Bounce house for my son\'s 6th birthday, June 14, about 30 kids.',
  'Do you have any slots open for Saturday the 12th?',
  'What time slots are open for the 4th of July?',
  'We\'re doing a casino night fundraiser and want a bounce house for the kids area.',
  'Casino night party for adults, need tables and a tent.',
  'Graduation party in Melrose, need a tent and 10 tables.',
  'Do you need an electrical hookup for the blower or do you bring a generator?',
  'Is there a water hookup needed for the water slide?',
  'Gender reveal party, we don\'t know the sex yet! Need a pink and blue bounce house.',
  'Quinceañera for my daughter, 14 escorts plus family, need a tent.',
  'Nude and blush balloon arch for a bridal shower please.',
  'Hi I want to know your price',
  'Hi, I wanted to know your price for the castle.',
  'Hola buenas tardes, water slide for Saturday?',
  'Hola, bounce house for June 6 por favor',
  'Xin chao. Water slide Saturday?',
  'Hej hej! Bounce castle Saturday?',
  'Venue: https://maps.app.goo.gl/QwErTy987',
  'Here is the park https://goo.gl/maps/abc123',
  'Party is at the park, map: https://www.google.com/maps/place/Riverside+Park and pics https://www.facebook.com/events/12345',
  'Venmo ok? https://venmo.com/u/Pat-Olson',
  'My linktree has the party details: https://linktr.ee/patolson',
  'Dropbox of the yard: https://www.dropbox.com/scl/fi/aB3dE6gH9/yard.jpg?rlkey=xYz12AbC&dl=0',
  'Yard pics https://www.dropbox.com/scl/fi/aB3dE6gH9/yard.jpg?rlkey=xYz12AbC&dl=0',
  'Interested!',
  'Congratulations on the new business!',
  'Kong themed party? Need the gorilla bounce house',
  'Betting it rains, do you have a tent too?',
  'Our church gambling-free family fun night needs 3 inflatables.',
  'Sexy 30th birthday for my wife lol, adult bounce house?',
  'We\'re in Sauk Rapids, need it set up by 10.',
].forEach((m) => add('hh', m));
add('hh', 'Bounce house please', { text: 'Grand Casino Hinckley event center' });
add('hh', 'Need the castle 2-6pm', { text: 'Des Moines Ave park, Sauk Rapids' });

// --- remodel requests (Revisions Unlimited / construction)
[
  'Kitchen remodel quote, St. Cloud, about 200 sq ft.',
  'We want a slot drain in the new walk-in shower.',
  'Need a linear slot drain and heated floor in the master bath.',
  'Concrete pour for garage slab, est 24x24',
  'Garage slab pour, 24x30, est start May',
  'Need someone to pour footings for a deck, est. 12 piers.',
  'Moving a cabin, need a pilot car escort for the house move.',
  'We want nude tile in the bathroom, like a warm beige.',
  'Betting the roof is shot after that hail, can you look?',
  'Basement finish in Sartell, RV hookup in the garage too.',
  'Install a 50 amp RV hookup on the side of the garage.',
  'Is it possible to get on your schedule? Any open slot in March?',
  'Pics of the damage: https://photos.app.goo.gl/AbC123dEf',
  'Here are photos https://www.icloud.com/sharedalbum/#B0aBcDeFgHiJkL',
  'Bathroom remodel. Photos at www.olsonhomes.shop',
  'Call me at the office 320-555-2671 x123',
  'Hirschfeld here, need a deck quote',
].forEach((m) => add('ru', m));

// --- marketing agency (Style Marking)
[
  'I need SEO services for my plumbing company.',
  'Looking for SEO services and a new website for our bakery.',
  'We need more web traffic, our site gets no visitors.',
  'Can you help rank our website on Google? Our web traffic is down.',
  'Do you do backlinks as part of your SEO package?',
  'Do you write guest posts for our blog or just the site?',
  'We run a crypto ATM business and need a website.',
  'Our company sells forex trading courses, need a landing page.',
  'We are a casino resort and need social media management.',
  'Need a booking site with time slots for my salon.',
  'Dating app startup, need a marketing site.',
  'We sell betting analytics software, need a site redesign.',
  'Our store is at www.northwoodsgifts.store, need help with ads.',
  'Website is mountainbikes.shop and we want SEO.',
  'Our site is lakesbakery.online, need a refresh',
  'Our current site: https://www.brainerdboats.info and https://brainerdboats.com',
].forEach((m) => add('sm', m));

// --- names (with a short or empty message)
const NAMES = ['Anna Lindstrom', 'Erik Bergstrom', 'Karen Engstrom', 'Sven Nordstrom', 'Mary Sandstrom',
  'Paul Lundstrom', 'Greg Holmstrom', 'Lisa Ahlstrom', 'Dan Dahlstrom', 'Joy Hallstrom', 'Ron Carlstrom',
  'Sue Wahlstrom', 'Kim Hirschfeld', 'Tom Kirschner', 'Hans Deutschmann', 'Anna Kirchschlager', 'Jo Rothschild',
  'Kirk Kirschbaum', 'Ann Smith-Lindstrom', 'ERIK BERGSTROM', 'Mike Schwartz', 'Thao Nguyen', 'Kou Xiong',
  'Mai Vang', 'Pa Yang', 'Abdirahman Mohamed', 'Hinda Abdi', "Patrick O'Brien", 'Jean-Luc Picard', 'Cher',
  'Madonna', 'Sarah Gamble', 'Jim Casino', 'Arne Slot', 'Pornchai Srisuk', 'Della Del Rio', 'Xin Chao',
  'Kong Xin', 'Ola Hei', 'Les Des Roches', 'Vita Della', 'Chao Kong', 'Di Toi', 'Mkrtich Mkrtchyan',
  'Steve Hrbek', 'Joe Strnad', 'Al Przybylski', 'Mark Szczepanski', 'Bob Sexton', 'Anne Sexauer', 'Olesya Krupchak',
  'Олександр Коваленко', 'Αλέξανδρος Παπαδόπουλος', '王小明', 'Nguyễn Văn An', 'José Muñoz', 'Zoë Ångström'];
for (const n of NAMES) {
  add('hm', '', { name: n, note: 'showing form (no message field)' });
  add('hh', 'Call me', { name: n });
  add('hh', 'Interested!', { name: n });
}

// --- phones and emails
const PHONES = ['320-555-2671 x123', '(320) 555-2671 ext 4', '+1 320 555 2671', '320.555.2671', '320 555 2671',
  '1-320-555-2671', '+1 (204) 555-2671', '204-555-2671', '+44 20 7946 0958', '44 20 7946 0958', '011 44 20 7946 0958',
  '0044 20 7946 0958', '(+44) 20 7946 0958', '+252 61 555 1234', '252 61 555 1234', '+52 1 55 1234 5678',
  '555-2671', '253-2671', '320-555-2671 cell', 'cell 320-555-2671 / work 320-555-9876', '+1 320-555-2671 ext. 22',
  '320 5552671', '3205552671', '+13205552671', '320-555-0123', '612-555-0100'];
for (const p of PHONES) add('hm', 'We would like to see the house on Lake Osakis this weekend.', { phone: p, note: 'phone format' });
const EMAILS = ['Pat.Olson+zillow@Gmail.com', 'PAT@GMAIL.COM', 'p.a.olson@gmail.com', 'pat@mail.olsonfamily.co.uk',
  'josé@correo.mx', 'j.r.r.tolkien.fan@gmail.com', 'a.b.c.d.e@gmail.com', 'm.j.k.lindstrom.2@yahoo.com',
  'pat@olson.info', 'pat@olson.live', 'pat_olson@icloud.com', 'pat@stcloudstate.edu'];
for (const e of EMAILS) add('hm', 'We would like to see the house on Lake Osakis this weekend.', { email: e, note: 'email format' });

module.exports = { C, D };
