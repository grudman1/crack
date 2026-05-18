# Structural audit log

Entries before pass: **3457**
Entries after pass: **3442**
Decisions: **96**

## Pattern A — `X of <place>` suffix

Total: 16  ·  reassign: 6  ·  remove: 6  ·  leave: 4

- **AH** · _remove_ — `p('Augustine of Hippo', 'Augustine of Hippo ( aw-GUST-in…')`
    · pre-suffix "Augustine" collapses to mononym
- **CE** · _reassign_ — `p('Charles I of England', 'Charles I (19 November 1600 – 30 January 1649) was King of England, Scotland…')`
    → **CI**: `p('Charles I', 'Charles I (19 November 1600 – 30 January 1649) was King of England, Scotland…', 'Charles_I_of_England')`
    · pre-suffix "Charles I" → bucket CI, slug Charles_I_of_England
- **DW** · _remove_ — `p('Diana, Princess of Wales', 'Diana, Princess of Wales (born Diana Frances Spencer; 1 July 1961 – 31 August 1997)…')`
    · pre-suffix "Diana" collapses to mononym
- **EI** · _reassign_ — `p('Edward Guinness, 1st Earl of Iveagh', 'Edward Cecil Guinness, 1st Earl of Iveagh,  (10 November 1847 – 7 October 1927)…')`
    → **EG**: `p('Edward Guinness', 'Edward Cecil Guinness, 1st Earl of Iveagh,  (10 November 1847 – 7 October 1927)…', 'Edward_Guinness,_1st_Earl_of_Iveagh')`
    · pre-suffix "Edward Guinness" → bucket EG, slug Edward_Guinness,_1st_Earl_of_Iveagh
- **ET** · _leave_ — `p('Emperor Taizong of Tang', 'Emperor of China from 626 to 649')`
    · pre-suffix "Emperor Taizong" initials already match current bucket — leave alone
- **FI** · _leave_ — `p('Faisal I of Iraq', 'King of Iraq from 1921 to 1933')`
    · pre-suffix "Faisal I" initials already match current bucket — leave alone
- **HN** · _reassign_ — `p('Haakon, Crown Prince of Norway', 'Haakon, Crown Prince of Norway (Norwegian pronunciation: [ˈhôːkʊn]; Haakon Magnus; born 20 July 1973)…')`
    → **HP**: `p('Haakon, Crown Prince', 'Haakon, Crown Prince of Norway (Norwegian pronunciation: [ˈhôːkʊn]; Haakon Magnus; born 20 July 1973)…', 'Haakon,_Crown_Prince_of_Norway')`
    · pre-suffix "Haakon, Crown Prince" → bucket HP, slug Haakon,_Crown_Prince_of_Norway
- **KK** · _remove_ — `p('Katharine, Duchess of Kent', 'Katharine, Duchess of Kent (born Katharine Lucy Mary Worsley; 22 February 1933 – 4 September 2025)…')`
    · pre-suffix "Katharine" collapses to mononym
- **MN** · _reassign_ — `p('Mette-Marit, Crown Princess of Norway', 'Mette-Marit, Crown Princess of Norway (born Mette-Marit Tjessem Høiby 19 August 1973)…')`
    → **MP**: `p('Mette-Marit, Crown Princess', 'Mette-Marit, Crown Princess of Norway (born Mette-Marit Tjessem Høiby 19 August 1973)…', 'Mette-Marit,_Crown_Princess_of_Norway')`
    · pre-suffix "Mette-Marit, Crown Princess" → bucket MP, slug Mette-Marit,_Crown_Princess_of_Norway
- **MS** · _remove_ — `p('Mary, Queen of Scots', 'Mary, Queen of Scots (8 December 1542 – 8 February 1587), also known as Mary Stuart or Mary I of Scotland…')`
    · pre-suffix "Mary" collapses to mononym
- **PE** · _leave_ — `p('Prince Edward, Duke of Edinburgh', 'Prince Edward, Duke of Edinburgh (Edward Antony Richard Louis; born 10 March 1964)…')`
    · pre-suffix "Prince Edward" initials already match current bucket — leave alone
- **PK** · _reassign_ — `p('Prince Edward, Duke of Kent', 'Prince Edward, Duke of Kent (Edward George Nicholas Paul Patrick; born 9 October 1935)…')`
    → **PE**: `p('Prince Edward', 'Prince Edward, Duke of Kent (Edward George Nicholas Paul Patrick; born 9 October 1935)…', 'Prince_Edward,_Duke_of_Kent')`
    · pre-suffix "Prince Edward" → bucket PE, slug Prince_Edward,_Duke_of_Kent
- **PK** · _reassign_ — `p('Prince George, Duke of Kent', 'Prince George, Duke of Kent (George Edward Alexander Edmund; 20 December 1902 – 25 August 1942)…')`
    → **PG**: `p('Prince George', 'Prince George, Duke of Kent (George Edward Alexander Edmund; 20 December 1902 – 25 August 1942)…', 'Prince_George,_Duke_of_Kent')`
    · pre-suffix "Prince George" → bucket PG, slug Prince_George,_Duke_of_Kent
- **RP** · _leave_ — `p('Reza Pahlavi, Crown Prince of Iran', 'Reza Pahlavi (born 31 October 1960) is an Iranian political activist and the former Crown Prince of the…')`
    · pre-suffix "Reza Pahlavi, Crown Prince" initials already match current bucket — leave alone
- **WW** · _remove_ — `p('William, Prince of Wales', 'William, Prince of Wales (William Arthur Philip Louis; born 21 June 1982)…')`
    · pre-suffix "William" collapses to mononym
- **YJ** · _remove_ — `p('Yeonsangun of Joseon', 'Yeonsangun or Prince Yeonsan (Korean: 연산군; Hanja: 燕山君; 23 November 1476 – 20 November 1506)…')`
    · pre-suffix "Yeonsangun" collapses to mononym

## Pattern B — Roman-numeral tail

Total: 50  ·  reassign: 8  ·  remove: 9  ·  leave: 33

- **AI** · _reassign_ — `p('Arthur Guinness II', 'Arthur Guinness (12 March 1768 – 9 June 1855) was an Anglo-Irish brewer, banker…')`
    → **AG**: `p('Arthur Guinness II', 'Arthur Guinness (12 March 1768 – 9 June 1855) was an Anglo-Irish brewer, banker…', 'Arthur_Guinness_II')`
    · pre-suffix "Arthur Guinness" → bucket AG, slug Arthur_Guinness_II
- **BI** · _leave_ — `p('Beatrice I', 'Beatrice I, also known as Beatrice of Franconia (German: Beatrix von Franken; 1037 – 13 July 1061)…', 'Beatrice_I,_Abbess_of_Quedlinburg')`
    · explicit slug "Beatrice_I,_Abbess_of_Quedlinburg" differs from derived "Beatrice_I" — treat as previously curated
- **CI** · _remove_ — `p('Charles III', 'King of the United Kingdom since 2022')`
    · pre-suffix "Charles" collapses to mononym
- **CI** · _reassign_ — `p('Cleto Escobedo III', 'American bandleader (1966–2025)')`
    → **CE**: `p('Cleto Escobedo III', 'American bandleader (1966–2025)', 'Cleto_Escobedo_III')`
    · pre-suffix "Cleto Escobedo" → bucket CE, slug Cleto_Escobedo_III
- **DI** · _leave_ — `p('Darius I', 'Persian ruler from 522 to 486 BCE', 'Darius_I_of_Persia')`
    · explicit slug "Darius_I_of_Persia" differs from derived "Darius_I" — treat as previously curated
- **EI** · _remove_ — `p('Elizabeth II', 'Elizabeth II (Elizabeth Alexandra Mary; 21 April 1926…')`
    · pre-suffix "Elizabeth" collapses to mononym
- **EI** · _leave_ — `p('Elizabeth I', 'Queen of England and Ireland from 1558 to 1603', 'Elizabeth_I_of_England')`
    · explicit slug "Elizabeth_I_of_England" differs from derived "Elizabeth_I" — treat as previously curated
- **EI** · _leave_ — `p('Ermengol III', 'Ermengol or Armengol III (1032 – 1065), called el de Barbastro…', 'Ermengol_III,_Count_of_Urgell')`
    · explicit slug "Ermengol_III,_Count_of_Urgell" differs from derived "Ermengol_III" — treat as previously curated
- **EV** · _remove_ — `p('Edward VIII', 'Edward VIII (Edward Albert Christian George Andrew Patrick David; 23 June 1894 – 28 May 1972)…')`
    · pre-suffix "Edward" collapses to mononym
- **EV** · _remove_ — `p('Edward VII', 'Edward VII (Albert Edward; 9 November 1841…')`
    · pre-suffix "Edward" collapses to mononym
- **EV** · _leave_ — `p('Edward VI', 'King of England and Ireland from 1547 to 1553', 'Edward_VI_of_England')`
    · explicit slug "Edward_VI_of_England" differs from derived "Edward_VI" — treat as previously curated
- **FI** · _leave_ — `p('Frederick II', 'King of Prussia from 1740 to 1786', 'Frederick_II_of_Prussia')`
    · explicit slug "Frederick_II_of_Prussia" differs from derived "Frederick_II" — treat as previously curated
- **GI** · _remove_ — `p('George III', 'George III (George William Frederick; 4 June 1738…')`
    · pre-suffix "George" collapses to mononym
- **GV** · _remove_ — `p('George VI', 'George VI (Albert Frederick Arthur George; 14 December 1895…')`
    · pre-suffix "George" collapses to mononym
- **GV** · _remove_ — `p('George V', 'George V (George Frederick Ernest Albert; 3 June 1865…')`
    · pre-suffix "George" collapses to mononym
- **HI** · _leave_ — `p('Haile Selassie I', 'Emperor of Ethiopia from 1930 to 1974', 'Haile_Selassie_I_of_Ethiopia')`
    · explicit slug "Haile_Selassie_I_of_Ethiopia" differs from derived "Haile_Selassie_I" — treat as previously curated
- **HI** · _leave_ — `p('Henry IV', 'French king, 1553-1610', 'Henry_IV_of_France')`
    · explicit slug "Henry_IV_of_France" differs from derived "Henry_IV" — treat as previously curated
- **HV** · _leave_ — `p('Henry VIII', 'King of England from 1509 to 1547', 'Henry_VIII_of_England')`
    · explicit slug "Henry_VIII_of_England" differs from derived "Henry_VIII" — treat as previously curated
- **HV** · _leave_ — `p('Harald V', 'King of Norway since 1991', 'Harald_V_of_Norway')`
    · explicit slug "Harald_V_of_Norway" differs from derived "Harald_V" — treat as previously curated
- **ID** · _leave_ — `p('Ichikawa Danjūrō XII', 'Ichikawa Danjūrō XII (十二代目 市川 團十郎, Jūnidaime Ichikawa Danjūrō; August 6, 1946 – February 3…')`
    · pre-suffix "Ichikawa Danjūrō" initials already match current bucket — leave alone
- **JI** · _reassign_ — `p('James VI and I', 'James VI and I (James Charles Stuart; 19 June 1566…')`
    → **JA**: `p('James VI and I', 'James VI and I (James Charles Stuart; 19 June 1566…', 'James_VI_and_I')`
    · pre-suffix "James VI and" → bucket JA, slug James_VI_and_I
- **KI** · _remove_ — `p('Kamehameha I', 'Kamehameha I (Hawaiian pronunciation: [kəmehəˈmɛhə]; Kalani Paiʻea Wohi o Kaleikini Kealiʻikui Kamehameha o…')`
    · pre-suffix "Kamehameha" collapses to mononym
- **LX** · _leave_ — `p('Louis XIV', 'King of France from 1643 to 1715', 'Louis_XIV_of_France')`
    · explicit slug "Louis_XIV_of_France" differs from derived "Louis_XIV" — treat as previously curated
- **LX** · _reassign_ — `p('Lil Nas X', 'Montero Lamar Hill (born April 9, 1999), better known by his stage name Lil Nas X ( NAHZ)…')`
    → **LN**: `p('Lil Nas X', 'Montero Lamar Hill (born April 9, 1999), better known by his stage name Lil Nas X ( NAHZ)…', 'Lil_Nas_X')`
    · pre-suffix "Lil Nas" → bucket LN, slug Lil_Nas_X
- **MI** · _leave_ — `p('Mary I', 'Queen of England and Ireland from 1553 to 1558', 'Mary_I_of_England')`
    · explicit slug "Mary_I_of_England" differs from derived "Mary_I" — treat as previously curated
- **MX** · _remove_ — `p('Malcolm X', 'Malcolm X (born Malcolm Little, later el-Hajj Malik el-Shabazz; May 19, 1925 – February 21…')`
    · pre-suffix "Malcolm" collapses to mononym
- **NI** · _leave_ — `p('Neoptolemus II', 'Neoptolemus II (Greek: Νεοπτόλεμος; died 297 BC) was king of Epirus from 302 BC until his death.', 'Neoptolemus_II_of_Epirus')`
    · explicit slug "Neoptolemus_II_of_Epirus" differs from derived "Neoptolemus_II" — treat as previously curated
- **OI** · _leave_ — `p('Olaf III', 'Olaf III or Olaf Haraldsson (Old Norse: Óláfr Haraldsson, Norwegian: Olav Haraldsson; c. 1050…', 'Olaf_III_of_Norway')`
    · explicit slug "Olaf_III_of_Norway" differs from derived "Olaf_III" — treat as previously curated
- **OI** · _leave_ — `p('Otto I', 'Otto I (1045 – 9 June 1087), known as Otto the Fair (Czech: Ota Sličný), a member of the Přemyslid dynasty…', 'Otto_I_of_Olomouc')`
    · explicit slug "Otto_I_of_Olomouc" differs from derived "Otto_I" — treat as previously curated
- **PA** · _leave_ — `p('Pope Alexander VI', 'Head of the Catholic Church from 1492 to 1503')`
    · pre-suffix "Pope Alexander" initials already match current bucket — leave alone
- **PB** · _leave_ — `p('Pope Benedict XVI', 'Head of the Catholic Church from 2005 to 2013')`
    · pre-suffix "Pope Benedict" initials already match current bucket — leave alone
- **PB** · _leave_ — `p('Pope Benedict XV', 'Head of the Catholic Church from 1914 to 1922')`
    · pre-suffix "Pope Benedict" initials already match current bucket — leave alone
- **PG** · _leave_ — `p('Pope Gregory I', '64th Bishop of Rome; head of the Roman Catholic Church from AD 590 to 604')`
    · pre-suffix "Pope Gregory" initials already match current bucket — leave alone
- **PG** · _leave_ — `p('Pope Gregory VII', 'Head of the Catholic Church from 1073 to 1085')`
    · pre-suffix "Pope Gregory" initials already match current bucket — leave alone
- **PI** · _leave_ — `p('Peter I', 'Tsar of Russia from 1682 to 1725', 'Peter_I_of_Russia')`
    · explicit slug "Peter_I_of_Russia" differs from derived "Peter_I" — treat as previously curated
- **PI** · _reassign_ — `p('Pope John Paul I', 'Pope John Paul I (born Albino Luciani; 17 October 1912…')`
    → **PP**: `p('Pope John Paul I', 'Pope John Paul I (born Albino Luciani; 17 October 1912…', 'Pope_John_Paul_I')`
    · pre-suffix "Pope John Paul" → bucket PP, slug Pope_John_Paul_I
- **PI** · _leave_ — `p('Philip II', 'King of Spain (1556–1598) and Portugal (1580–1598)', 'Philip_II_of_Spain')`
    · explicit slug "Philip_II_of_Spain" differs from derived "Philip_II" — treat as previously curated
- **PI** · _reassign_ — `p('Pope Leo I', 'Pope Leo I (Italian: Leone I) (c.')`
    → **PL**: `p('Pope Leo I', 'Pope Leo I (Italian: Leone I) (c.', 'Pope_Leo_I')`
    · pre-suffix "Pope Leo" → bucket PL, slug Pope_Leo_I
- **PJ** · _leave_ — `p('Pope Julius II', 'Head of the Catholic Church from 1503 to 1513')`
    · pre-suffix "Pope Julius" initials already match current bucket — leave alone
- **PL** · _leave_ — `p('Pope Leo XIII', 'Head of the Catholic Church from 1878 to 1903')`
    · pre-suffix "Pope Leo" initials already match current bucket — leave alone
- **PL** · _leave_ — `p('Pope Leo X', 'Head of the Catholic Church from 1513 to 1521')`
    · pre-suffix "Pope Leo" initials already match current bucket — leave alone
- **PP** · _leave_ — `p('Pope John Paul II', 'Head of the Catholic Church from 1978 to 2005')`
    · pre-suffix "Pope John Paul" initials already match current bucket — leave alone
- **PP** · _leave_ — `p('Pope Pius XII', 'Head of the Catholic Church from 1939 to 1958')`
    · pre-suffix "Pope Pius" initials already match current bucket — leave alone
- **PV** · _reassign_ — `p('Pope Paul VI', 'Pope Paul VI (born Giovanni Battista Enrico Antonio Maria Montini; 26 September 1897…')`
    → **PP**: `p('Pope Paul VI', 'Pope Paul VI (born Giovanni Battista Enrico Antonio Maria Montini; 26 September 1897…', 'Pope_Paul_VI')`
    · pre-suffix "Pope Paul" → bucket PP, slug Pope_Paul_VI
- **PX** · _reassign_ — `p('Pope Leo XIV', 'Pope Leo XIV (born Robert Francis Prevost, pronounced  PREE-vohst, September 14…')`
    → **PL**: `p('Pope Leo XIV', 'Pope Leo XIV (born Robert Francis Prevost, pronounced  PREE-vohst, September 14…', 'Pope_Leo_XIV')`
    · pre-suffix "Pope Leo" → bucket PL, slug Pope_Leo_XIV
- **QE** · _leave_ — `p('Queen Elizabeth II', 'Queen of the United Kingdom, 1926-2022', 'Elizabeth_II')`
    · explicit slug "Elizabeth_II" differs from derived "Queen_Elizabeth_II" — treat as previously curated
- **RI** · _leave_ — `p('Richard I', 'King of England from 1189 to 1199', 'Richard_I_of_England')`
    · explicit slug "Richard_I_of_England" differs from derived "Richard_I" — treat as previously curated
- **UI** · _leave_ — `p('Ulric II', 'Ulric II (also Ulrich, Odalric, Oudalricus…', 'Ulric_II,_Margrave_of_Carniola')`
    · explicit slug "Ulric_II,_Margrave_of_Carniola" differs from derived "Ulric_II" — treat as previously curated
- **WI** · _leave_ — `p('William III', 'King of England, Scotland, and Ireland from 1689 to 1702', 'William_III_of_England')`
    · explicit slug "William_III_of_England" differs from derived "William_III" — treat as previously curated
- **YI** · _leave_ — `p('Yaropolk II', 'Yaropolk II Vladimirovich (1082…', 'Yaropolk_II_of_Kiev')`
    · explicit slug "Yaropolk_II_of_Kiev" differs from derived "Yaropolk_II" — treat as previously curated

## Pattern C — `computeNameInitials(name)` ≠ bucket

Total: 30  ·  reassign: 0  ·  remove: 0  ·  leave: 30

- **AD** · _leave_ — `p('Alfred Adler', 'psychotherapist, 1870-1937')`
    · computeNameInitials="AA" bucket="AD" — flagged for review; not auto-touched.
- **AT** · _leave_ — `p('André the Giant', 'wrestler and actor, 1946-1993')`
    · computeNameInitials="AG" bucket="AT" — flagged for review; not auto-touched.
- **BD** · _leave_ — `p('Brian De Palma', 'filmmaker, b. 1940')`
    · computeNameInitials="BP" bucket="BD" — flagged for review; not auto-touched.
- **CJ** · _leave_ — `p('Chris Eubank Jr', 'Christopher Livingstone Eubank Jr (born 18 September 1989) is a British professional boxer.')`
    · computeNameInitials="CE" bucket="CJ" — flagged for review; not auto-touched.
- **DJ** · _leave_ — `p('Donald Trump Jr.', 'Donald John Trump Jr.')`
    · computeNameInitials="DT" bucket="DJ" — flagged for review; not auto-touched.
- **DO** · _leave_ — `p('Daniel Ortega Saavedra', 'Leader of Nicaragua (1979–1990; since 2007)')`
    · computeNameInitials="DS" bucket="DO" — flagged for review; not auto-touched.
- **ER** · _leave_ — `p('Edward R. Murrow', 'journalist, 1908-1965')`
    · computeNameInitials="EM" bucket="ER" — flagged for review; not auto-touched.
- **FJ** · _leave_ — `p('Floyd Mayweather Jr.', 'Floyd Joy Mayweather Jr.')`
    · computeNameInitials="FM" bucket="FJ" — flagged for review; not auto-touched.
- **FJ** · _leave_ — `p('Freddie Prinze Jr.', 'Freddie James Prinze Jr.')`
    · computeNameInitials="FP" bucket="FJ" — flagged for review; not auto-touched.
- **HG** · _leave_ — `p('H. G. Wells', 'novelist, 1866-1946')`
    · computeNameInitials="HW" bucket="HG" — flagged for review; not auto-touched.
- **JJ** · _leave_ — `p('John F. Kennedy Jr.', 'John Fitzgerald Kennedy Jr.')`
    · computeNameInitials="JK" bucket="JJ" — flagged for review; not auto-touched.
- **JK** · _leave_ — `p('J. K. Rowling', 'novelist, b. 1965')`
    · computeNameInitials="JR" bucket="JK" — flagged for review; not auto-touched.
- **JV** · _leave_ — `p('James Van Der Beek', 'actor (Dawson\'s Creek), b. 1977')`
    · computeNameInitials="JB" bucket="JV" — flagged for review; not auto-touched.
- **KD** · _leave_ — `p('Gary Plauché', 'On March 16, 1984, Leon Gary Plauché ( ploh-SHAY; November 10, 1945 – October 20…')`
    · computeNameInitials="GP" bucket="KD" — flagged for review; not auto-touched.
- **KI** · _leave_ — `p('Kenneth Walker III (running back)', 'Kenneth Walker III (born October 20…')`
    · computeNameInitials="KW" bucket="KI" — flagged for review; not auto-touched.
- **LD** · _leave_ — `p('Lana Del Rey', 'singer, b. 1985')`
    · computeNameInitials="LR" bucket="LD" — flagged for review; not auto-touched.
- **LY** · _leave_ — `p('Im Yoon-ah', 'Lim Yoona (Korean: 임윤아; born May 30, 1990), also known mononymously as Yoona…')`
    · computeNameInitials="IY" bucket="LY" — flagged for review; not auto-touched.
- **ME** · _leave_ — `p('Margaret E. Knight', 'inventor, 1838-1914')`
    · computeNameInitials="MK" bucket="ME" — flagged for review; not auto-touched.
- **NJ** · _leave_ — `p('N. T. Rama Rao Jr.', 'Nandamuri Taraka Rama Rao (born 20 May 1983), popularly known as NTR Jr, is an Indian actor, producer…')`
    · computeNameInitials="NR" bucket="NJ" — flagged for review; not auto-touched.
- **OA** · _leave_ — `p('Omar Abdel Rahman', 'Sheikh Omar Abdel-Rahman (Arabic: عمر عبد الرحمن), (ʾUmar ʾAbd ar-Raḥmān; 3 May 1938 – 18 February 2017)…')`
    · computeNameInitials="OR" bucket="OA" — flagged for review; not auto-touched.
- **OD** · _leave_ — `p('Oscar De La Hoya', 'Oscar De La Hoya ( DAY lə HOY-ə, Spanish: [ˈoskaɾ ðe la ˈoʝa]; born February 4…')`
    · computeNameInitials="OH" bucket="OD" — flagged for review; not auto-touched.
- **OJ** · _leave_ — `p('O. J. Simpson', 'NFL/celebrity, 1947-2024')`
    · computeNameInitials="OS" bucket="OJ" — flagged for review; not auto-touched.
- **RD** · _leave_ — `p('Rebecca De Mornay', 'actress, b. 1959')`
    · computeNameInitials="RM" bucket="RD" — flagged for review; not auto-touched.
- **RJ** · _leave_ — `p('Robert Downey Jr.', 'American actor (born 1965)')`
    · computeNameInitials="RD" bucket="RJ" — flagged for review; not auto-touched.
- **RJ** · _leave_ — `p('Robert F. Kennedy Jr.', 'Robert Francis Kennedy Jr.')`
    · computeNameInitials="RK" bucket="RJ" — flagged for review; not auto-touched.
- **SV** · _leave_ — `p('Stevie Van Zandt', 'musician, b. 1950')`
    · computeNameInitials="SZ" bucket="SV" — flagged for review; not auto-touched.
- **TV** · _leave_ — `p('Thomas von Essen', 'Thomas von Essen (born 1945 in Brooklyn…')`
    · computeNameInitials="TE" bucket="TV" — flagged for review; not auto-touched.
- **VA** · _leave_ — `p('V. S. Achuthanandan', 'Velikkakathu Sankaran Achuthanandan (20 October 1923 – 21 July 2025), also known by his initialism VS…')`
    · computeNameInitials="SA" bucket="VA" — flagged for review; not auto-touched.
- **VE** · _leave_ — `p('V. J. Edgecombe', 'Valdez Drexel "V.')`
    · computeNameInitials="JE" bucket="VE" — flagged for review; not auto-touched.
- **VJ** · _leave_ — `p('Vladimir Guerrero Jr.', 'Dominican-Canadian baseball player (born 1999)')`
    · computeNameInitials="VG" bucket="VJ" — flagged for review; not auto-touched.
