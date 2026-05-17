# Structural audit log

Entries before pass: **3048**
Entries after pass: **3006**
Decisions: **131**

## Pattern A — `X of <place>` suffix

Total: 81  ·  reassign: 43  ·  remove: 36  ·  leave: 2

- **BN** · _remove_ — `p('Benedict of Nursia', 'religious figure')`
    · pre-suffix "Benedict" collapses to mononym
- **BQ** · _reassign_ — `p('Beatrice I, Abbess of Quedlinburg', 'leadership')`
    → **BI**: `p('Beatrice I', 'leadership', 'Beatrice_I,_Abbess_of_Quedlinburg')`
    · pre-suffix "Beatrice I" → bucket BI, slug Beatrice_I,_Abbess_of_Quedlinburg
- **BZ** · _remove_ — `p('Braulio of Zaragoza', 'leadership')`
    · pre-suffix "Braulio" collapses to mononym
- **CE** · _reassign_ — `p('Charles I of England', 'politician')`
    → **CI**: `p('Charles I', 'politician', 'Charles_I_of_England')`
    · pre-suffix "Charles I" → bucket CI, slug Charles_I_of_England
- **CR** · _reassign_ — `p('Catherine II of Russia', 'nobleman')`
    → **CI**: `p('Catherine II', 'nobleman', 'Catherine_II_of_Russia')`
    · pre-suffix "Catherine II" → bucket CI, slug Catherine_II_of_Russia
- **CS** · _remove_ — `p('Catherine of Siena', 'religious figure')`
    · pre-suffix "Catherine" collapses to mononym
- **CZ** · _reassign_ — `p('Conrad I, Duke of Zähringen', 'medieval German duke, 1090-1152')`
    → **CI**: `p('Conrad I', 'medieval German duke, 1090-1152', 'Conrad_I,_Duke_of_Zähringen')`
    · pre-suffix "Conrad I" → bucket CI, slug Conrad_I,_Duke_of_Zähringen
- **DP** · _reassign_ — `p('Darius I of Persia', 'politician')`
    → **DI**: `p('Darius I', 'politician', 'Darius_I_of_Persia')`
    · pre-suffix "Darius I" → bucket DI, slug Darius_I_of_Persia
- **DQ** · _reassign_ — `p('Duke Xiao of Qin', 'leadership')`
    → **DX**: `p('Duke Xiao', 'leadership', 'Duke_Xiao_of_Qin')`
    · pre-suffix "Duke Xiao" → bucket DX, slug Duke_Xiao_of_Qin
- **DV** · _remove_ — `p('Desiderius of Vienne', 'leadership')`
    · pre-suffix "Desiderius" collapses to mononym
- **DV** · _reassign_ — `p('Diepold III, Margrave of Vohburg', 'leadership')`
    → **DI**: `p('Diepold III', 'leadership', 'Diepold_III,_Margrave_of_Vohburg')`
    · pre-suffix "Diepold III" → bucket DI, slug Diepold_III,_Margrave_of_Vohburg
- **DW** · _remove_ — `p('Diana, Princess of Wales', 'nobleman')`
    · pre-suffix "Diana" collapses to mononym
- **EC** · _remove_ — `p('Eusebius of Caesarea', 'philosopher')`
    · pre-suffix "Eusebius" collapses to mononym
- **EE** · _reassign_ — `p('Elizabeth I of England', 'politician')`
    → **EI**: `p('Elizabeth I', 'politician', 'Elizabeth_I_of_England')`
    · pre-suffix "Elizabeth I" → bucket EI, slug Elizabeth_I_of_England
- **EE** · _reassign_ — `p('Edward VI of England', 'politician')`
    → **EV**: `p('Edward VI', 'politician', 'Edward_VI_of_England')`
    · pre-suffix "Edward VI" → bucket EV, slug Edward_VI_of_England
- **ET** · _leave_ — `p('Emperor Taizong of Tang', 'politician')`
    · pre-suffix "Emperor Taizong" initials already match current bucket — leave alone
- **EU** · _reassign_ — `p('Ermengol III, Count of Urgell', 'leadership')`
    → **EI**: `p('Ermengol III', 'leadership', 'Ermengol_III,_Count_of_Urgell')`
    · pre-suffix "Ermengol III" → bucket EI, slug Ermengol_III,_Count_of_Urgell
- **FA** · _remove_ — `p('Francis of Assisi', 'philosopher')`
    · pre-suffix "Francis" collapses to mononym
- **FI** · _leave_ — `p('Faisal I of Iraq', 'politician')`
    · pre-suffix "Faisal I" initials already match current bucket — leave alone
- **FP** · _reassign_ — `p('Frederick II of Prussia', 'writer')`
    → **FI**: `p('Frederick II', 'writer', 'Frederick_II_of_Prussia')`
    · pre-suffix "Frederick II" → bucket FI, slug Frederick_II_of_Prussia
- **HB** · _remove_ — `p('Hildegard of Bingen', 'religious figure')`
    · pre-suffix "Hildegard" collapses to mononym
- **HE** · _reassign_ — `p('Henry VIII of England', 'nobleman')`
    → **HV**: `p('Henry VIII', 'nobleman', 'Henry_VIII_of_England')`
    · pre-suffix "Henry VIII" → bucket HV, slug Henry_VIII_of_England
- **HE** · _reassign_ — `p('Haile Selassie I of Ethiopia', 'politician')`
    → **HI**: `p('Haile Selassie I', 'politician', 'Haile_Selassie_I_of_Ethiopia')`
    · pre-suffix "Haile Selassie I" → bucket HI, slug Haile_Selassie_I_of_Ethiopia
- **HF** · _reassign_ — `p('Henry IV of France', 'French king, 1553-1610')`
    → **HI**: `p('Henry IV', 'French king, 1553-1610', 'Henry_IV_of_France')`
    · pre-suffix "Henry IV" → bucket HI, slug Henry_IV_of_France
- **HJ** · _remove_ — `p('Hussein of Jordan', 'politician')`
    · pre-suffix "Hussein" collapses to mononym
- **HN** · _reassign_ — `p('Harald V of Norway', 'politician')`
    → **HV**: `p('Harald V', 'politician', 'Harald_V_of_Norway')`
    · pre-suffix "Harald V" → bucket HV, slug Harald_V_of_Norway
- **HO** · _reassign_ — `p('Horace Walpole, 4th Earl of Orford', 'politician')`
    → **HW**: `p('Horace Walpole', 'politician', 'Horace_Walpole,_4th_Earl_of_Orford')`
    · pre-suffix "Horace Walpole" → bucket HW, slug Horace_Walpole,_4th_Earl_of_Orford
- **IA** · _remove_ — `p('Ignatius of Antioch', 'religious figure')`
    · pre-suffix "Ignatius" collapses to mononym
- **IC** · _remove_ — `p('Iamblichus of Chalcis', 'philosopher')`
    · pre-suffix "Iamblichus" collapses to mononym
- **IC** · _remove_ — `p('Ivo of Chartres', 'leadership')`
    · pre-suffix "Ivo" collapses to mononym
- **IF** · _remove_ — `p('Ida of Formbach-Ratelnberg', 'leadership')`
    · pre-suffix "Ida" collapses to mononym
- **II** · _remove_ — `p('Imerius of Immertal', 'leadership')`
    · pre-suffix "Imerius" collapses to mononym
- **IL** · _remove_ — `p('Ignatius of Loyola', 'religious figure')`
    · pre-suffix "Ignatius" collapses to mononym
- **IN** · _remove_ — `p('Ingegerd of Norway', 'leadership')`
    · pre-suffix "Ingegerd" collapses to mononym
- **IS** · _remove_ — `p('Isidore of Seville', 'philosopher')`
    · pre-suffix "Isidore" collapses to mononym
- **JX** · _remove_ — `p('Jie of Xia', 'leadership')`
    · pre-suffix "Jie" collapses to mononym
- **KQ** · _reassign_ — `p('King Min of Qi', 'leadership')`
    → **KM**: `p('King Min', 'leadership', 'King_Min_of_Qi')`
    · pre-suffix "King Min" → bucket KM, slug King_Min_of_Qi
- **KQ** · _reassign_ — `p('King Xiaowen of Qin', 'leadership')`
    → **KX**: `p('King Xiaowen', 'leadership', 'King_Xiaowen_of_Qin')`
    · pre-suffix "King Xiaowen" → bucket KX, slug King_Xiaowen_of_Qin
- **KZ** · _reassign_ — `p('King Tai of Zhou', 'leadership')`
    → **KT**: `p('King Tai', 'leadership', 'King_Tai_of_Zhou')`
    · pre-suffix "King Tai" → bucket KT, slug King_Tai_of_Zhou
- **KZ** · _reassign_ — `p('King Wuling of Zhao', 'leadership')`
    → **KW**: `p('King Wuling', 'leadership', 'King_Wuling_of_Zhao')`
    · pre-suffix "King Wuling" → bucket KW, slug King_Wuling_of_Zhao
- **LF** · _reassign_ — `p('Louis XIV of France', 'politician')`
    → **LX**: `p('Louis XIV', 'politician', 'Louis_XIV_of_France')`
    · pre-suffix "Louis XIV" → bucket LX, slug Louis_XIV_of_France
- **ME** · _reassign_ — `p('Mary I of England', 'politician')`
    → **MI**: `p('Mary I', 'politician', 'Mary_I_of_England')`
    · pre-suffix "Mary I" → bucket MI, slug Mary_I_of_England
- **NE** · _reassign_ — `p('Neoptolemus II of Epirus', 'leadership')`
    → **NI**: `p('Neoptolemus II', 'leadership', 'Neoptolemus_II_of_Epirus')`
    · pre-suffix "Neoptolemus II" → bucket NI, slug Neoptolemus_II_of_Epirus
- **NX** · _remove_ — `p('Norbert of Xanten', 'leadership')`
    · pre-suffix "Norbert" collapses to mononym
- **OI** · _remove_ — `p('Olowe of Ise', 'culture')`
    · pre-suffix "Olowe" collapses to mononym
- **OK** · _remove_ — `p('Octa of Kent', 'leadership')`
    · pre-suffix "Octa" collapses to mononym
- **ON** · _reassign_ — `p('Olaf III of Norway', 'leadership')`
    → **OI**: `p('Olaf III', 'leadership', 'Olaf_III_of_Norway')`
    · pre-suffix "Olaf III" → bucket OI, slug Olaf_III_of_Norway
- **ON** · _reassign_ — `p('Olav Magnusson of Norway', 'other')`
    → **OM**: `p('Olav Magnusson', 'other', 'Olav_Magnusson_of_Norway')`
    · pre-suffix "Olav Magnusson" → bucket OM, slug Olav_Magnusson_of_Norway
- **OO** · _reassign_ — `p('Otto I of Olomouc', 'leadership')`
    → **OI**: `p('Otto I', 'leadership', 'Otto_I_of_Olomouc')`
    · pre-suffix "Otto I" → bucket OI, slug Otto_I_of_Olomouc
- **OZ** · _reassign_ — `p('Otto II, Count of Zutphen', 'leadership')`
    → **OI**: `p('Otto II', 'leadership', 'Otto_II,_Count_of_Zutphen')`
    · pre-suffix "Otto II" → bucket OI, slug Otto_II,_Count_of_Zutphen
- **PE** · _reassign_ — `p('Prince Philip, Duke of Edinburgh', 'nobleman')`
    → **PP**: `p('Prince Philip', 'nobleman', 'Prince_Philip,_Duke_of_Edinburgh')`
    · pre-suffix "Prince Philip" → bucket PP, slug Prince_Philip,_Duke_of_Edinburgh
- **PR** · _reassign_ — `p('Peter I of Russia', 'politician')`
    → **PI**: `p('Peter I', 'politician', 'Peter_I_of_Russia')`
    · pre-suffix "Peter I" → bucket PI, slug Peter_I_of_Russia
- **PS** · _reassign_ — `p('Philip II of Spain', 'politician')`
    → **PI**: `p('Philip II', 'politician', 'Philip_II_of_Spain')`
    · pre-suffix "Philip II" → bucket PI, slug Philip_II_of_Spain
- **PT** · _remove_ — `p('Paul of Tarsus', 'religious figure')`
    · pre-suffix "Paul" collapses to mononym
- **QH** · _reassign_ — `p('Queen Emma of Hawaii', 'leadership')`
    → **QE**: `p('Queen Emma', 'leadership', 'Queen_Emma_of_Hawaii')`
    · pre-suffix "Queen Emma" → bucket QE, slug Queen_Emma_of_Hawaii
- **QJ** · _reassign_ — `p('Queen Rania of Jordan', 'companion')`
    → **QR**: `p('Queen Rania', 'companion', 'Queen_Rania_of_Jordan')`
    · pre-suffix "Queen Rania" → bucket QR, slug Queen_Rania_of_Jordan
- **QN** · _reassign_ — `p('Queen Divyeshwari of Nepal', 'leadership')`
    → **QD**: `p('Queen Divyeshwari', 'leadership', 'Queen_Divyeshwari_of_Nepal')`
    · pre-suffix "Queen Divyeshwari" → bucket QD, slug Queen_Divyeshwari_of_Nepal
- **RE** · _reassign_ — `p('Richard I of England', 'politician')`
    → **RI**: `p('Richard I', 'politician', 'Richard_I_of_England')`
    · pre-suffix "Richard I" → bucket RI, slug Richard_I_of_England
- **SC** · _remove_ — `p('Simonides of Ceos', 'writer')`
    · pre-suffix "Simonides" collapses to mononym
- **SU** · _reassign_ — `p('Sancho Garcés, Lord of Uncastillo', 'leadership')`
    → **SG**: `p('Sancho Garcés', 'leadership', 'Sancho_Garcés,_Lord_of_Uncastillo')`
    · pre-suffix "Sancho Garcés" → bucket SG, slug Sancho_Garcés,_Lord_of_Uncastillo
- **TA** · _remove_ — `p('Teresa of Ávila', 'religious figure')`
    · pre-suffix "Teresa" collapses to mononym
- **TE** · _reassign_ — `p('Thomas Cromwell, 1st Earl of Essex', 'public worker')`
    → **TC**: `p('Thomas Cromwell', 'public worker', 'Thomas_Cromwell,_1st_Earl_of_Essex')`
    · pre-suffix "Thomas Cromwell" → bucket TC, slug Thomas_Cromwell,_1st_Earl_of_Essex
- **UC** · _reassign_ — `p('Ulric II, Margrave of Carniola', 'leadership')`
    → **UI**: `p('Ulric II', 'leadership', 'Ulric_II,_Margrave_of_Carniola')`
    · pre-suffix "Ulric II" → bucket UI, slug Ulric_II,_Margrave_of_Carniola
- **UE** · _remove_ — `p('Ulrich of Eppenstein', 'leadership')`
    · pre-suffix "Ulrich" collapses to mononym
- **UL** · _remove_ — `p('Urraca of León', 'leadership')`
    · pre-suffix "Urraca" collapses to mononym
- **UP** · _reassign_ — `p('Ulrich I, Bishop of Passau', 'leadership')`
    → **UB**: `p('Ulrich I, Bishop', 'leadership', 'Ulrich_I,_Bishop_of_Passau')`
    · pre-suffix "Ulrich I, Bishop" → bucket UB, slug Ulrich_I,_Bishop_of_Passau
- **US** · _reassign_ — `p('Uroš I, Grand Prince of Serbia', 'leadership')`
    → **UP**: `p('Uroš I, Grand Prince', 'leadership', 'Uroš_I,_Grand_Prince_of_Serbia')`
    · pre-suffix "Uroš I, Grand Prince" → bucket UP, slug Uroš_I,_Grand_Prince_of_Serbia
- **UZ** · _remove_ — `p('Urraca of Zamora', 'leadership')`
    · pre-suffix "Urraca" collapses to mononym
- **UZ** · _remove_ — `p('Ulrich of Zell', 'leadership')`
    · pre-suffix "Ulrich" collapses to mononym
- **VN** · _remove_ — `p('Vladimir of Novgorod', 'leadership')`
    · pre-suffix "Vladimir" collapses to mononym
- **WE** · _reassign_ — `p('William III of England', 'politician')`
    → **WI**: `p('William III', 'politician', 'William_III_of_England')`
    · pre-suffix "William III" → bucket WI, slug William_III_of_England
- **WO** · _remove_ — `p('William of Ockham', 'philosopher')`
    · pre-suffix "William" collapses to mononym
- **YG** · _remove_ — `p('Yejong of Goryeo', 'leadership')`
    · pre-suffix "Yejong" collapses to mononym
- **YJ** · _reassign_ — `p('Yeghishe Tourian of Jerusalem', 'culture')`
    → **YT**: `p('Yeghishe Tourian', 'culture', 'Yeghishe_Tourian_of_Jerusalem')`
    · pre-suffix "Yeghishe Tourian" → bucket YT, slug Yeghishe_Tourian_of_Jerusalem
- **YK** · _reassign_ — `p('Yaropolk II of Kiev', 'other')`
    → **YI**: `p('Yaropolk II', 'other', 'Yaropolk_II_of_Kiev')`
    · pre-suffix "Yaropolk II" → bucket YI, slug Yaropolk_II_of_Kiev
- **YP** · _reassign_ — `p('Yadanabon I of Pagan', 'leadership')`
    → **YI**: `p('Yadanabon I', 'leadership', 'Yadanabon_I_of_Pagan')`
    · pre-suffix "Yadanabon I" → bucket YI, slug Yadanabon_I_of_Pagan
- **ZC** · _remove_ — `p('Zeno of Citium', 'philosopher')`
    · pre-suffix "Zeno" collapses to mononym
- **ZE** · _remove_ — `p('Zeno of Elea', 'philosopher')`
    · pre-suffix "Zeno" collapses to mononym
- **ZK** · _remove_ — `p('Zbyslava of Kiev', 'leadership')`
    · pre-suffix "Zbyslava" collapses to mononym
- **ZP** · _remove_ — `p('Zbigniew of Poland', 'other')`
    · pre-suffix "Zbigniew" collapses to mononym
- **ZS** · _remove_ — `p('Zaida of Seville', 'leadership')`
    · pre-suffix "Zaida" collapses to mononym

## Pattern B — Roman-numeral tail

Total: 26  ·  reassign: 11  ·  remove: 6  ·  leave: 9

- **BX** · _remove_ — `p('Brother XII', 'culture')`
    · pre-suffix "Brother" collapses to mononym
- **CI** · _remove_ — `p('Constantine I', 'politician')`
    · pre-suffix "Constantine" collapses to mononym
- **CI** · _remove_ — `p('Cleombrotus I', 'leadership')`
    · pre-suffix "Cleombrotus" collapses to mononym
- **FI** · _remove_ — `p('Fariburz I', 'leadership')`
    · pre-suffix "Fariburz" collapses to mononym
- **IX** · _reassign_ — `p('Ichikawa Ebizō XI', 'culture')`
    → **IE**: `p('Ichikawa Ebizō XI', 'culture', 'Ichikawa_Ebizō_XI')`
    · pre-suffix "Ichikawa Ebizō" → bucket IE, slug Ichikawa_Ebizō_XI
- **IX** · _reassign_ — `p('Ichikawa Danjūrō XII', 'culture')`
    → **ID**: `p('Ichikawa Danjūrō XII', 'culture', 'Ichikawa_Danjūrō_XII')`
    · pre-suffix "Ichikawa Danjūrō" → bucket ID, slug Ichikawa_Danjūrō_XII
- **KX** · _reassign_ — `p('Kataoka Nizaemon XII', 'culture')`
    → **KN**: `p('Kataoka Nizaemon XII', 'culture', 'Kataoka_Nizaemon_XII')`
    · pre-suffix "Kataoka Nizaemon" → bucket KN, slug Kataoka_Nizaemon_XII
- **LI** · _remove_ — `p('Leonidas I', 'politician')`
    · pre-suffix "Leonidas" collapses to mononym
- **MX** · _reassign_ — `p('Morita Kanya XII', 'culture')`
    → **MK**: `p('Morita Kanya XII', 'culture', 'Morita_Kanya_XII')`
    · pre-suffix "Morita Kanya" → bucket MK, slug Morita_Kanya_XII
- **OI** · _remove_ — `p('Oyekan I', 'leadership')`
    · pre-suffix "Oyekan" collapses to mononym
- **PA** · _leave_ — `p('Pope Alexander VI', 'religious figure')`
    · pre-suffix "Pope Alexander" initials already match current bucket — leave alone
- **PB** · _leave_ — `p('Pope Boniface VIII', 'religious figure')`
    · pre-suffix "Pope Boniface" initials already match current bucket — leave alone
- **PG** · _leave_ — `p('Pope Gregory VII', 'religious figure')`
    · pre-suffix "Pope Gregory" initials already match current bucket — leave alone
- **PI** · _reassign_ — `p('Pope Gregory I', 'religious figure')`
    → **PG**: `p('Pope Gregory I', 'religious figure', 'Pope_Gregory_I')`
    · pre-suffix "Pope Gregory" → bucket PG, slug Pope_Gregory_I
- **PJ** · _leave_ — `p('Pope Julius II', 'religious figure')`
    · pre-suffix "Pope Julius" initials already match current bucket — leave alone
- **PL** · _leave_ — `p('Pope Leo X', 'religious figure')`
    · pre-suffix "Pope Leo" initials already match current bucket — leave alone
- **PP** · _leave_ — `p('Pope John Paul II', 'religious figure')`
    · pre-suffix "Pope John Paul" initials already match current bucket — leave alone
- **PU** · _leave_ — `p('Pope Urban VIII', 'religious figure')`
    · pre-suffix "Pope Urban" initials already match current bucket — leave alone
- **PU** · _leave_ — `p('Pope Urban II', 'leadership')`
    · pre-suffix "Pope Urban" initials already match current bucket — leave alone
- **PX** · _reassign_ — `p('Pope Benedict XVI', 'religious figure')`
    → **PB**: `p('Pope Benedict XVI', 'religious figure', 'Pope_Benedict_XVI')`
    · pre-suffix "Pope Benedict" → bucket PB, slug Pope_Benedict_XVI
- **PX** · _reassign_ — `p('Pope Pius XII', 'religious figure')`
    → **PP**: `p('Pope Pius XII', 'religious figure', 'Pope_Pius_XII')`
    · pre-suffix "Pope Pius" → bucket PP, slug Pope_Pius_XII
- **PX** · _reassign_ — `p('Pope Leo XIII', 'religious figure')`
    → **PL**: `p('Pope Leo XIII', 'religious figure', 'Pope_Leo_XIII')`
    · pre-suffix "Pope Leo" → bucket PL, slug Pope_Leo_XIII
- **PX** · _reassign_ — `p('Pope Benedict XV', 'religious figure')`
    → **PB**: `p('Pope Benedict XV', 'religious figure', 'Pope_Benedict_XV')`
    · pre-suffix "Pope Benedict" → bucket PB, slug Pope_Benedict_XV
- **RX** · _reassign_ — `p('Rama Varma XV', 'leadership')`
    → **RV**: `p('Rama Varma XV', 'leadership', 'Rama_Varma_XV')`
    · pre-suffix "Rama Varma" → bucket RV, slug Rama_Varma_XV
- **RX** · _reassign_ — `p('Rama Varma XVII', 'leadership')`
    → **RV**: `p('Rama Varma XVII', 'leadership', 'Rama_Varma_XVII')`
    · pre-suffix "Rama Varma" → bucket RV, slug Rama_Varma_XVII
- **YC** · _leave_ — `p('Young Corbett II', 'sports/games')`
    · pre-suffix "Young Corbett" initials already match current bucket — leave alone

## Pattern C — `computeNameInitials(name)` ≠ bucket

Total: 24  ·  reassign: 0  ·  remove: 0  ·  leave: 24

- **AB** · _leave_ — `p('Aziz Ansari', 'comedian, b. 1983')`
    · computeNameInitials="AA" bucket="AB" — flagged for review; not auto-touched.
- **AD** · _leave_ — `p('Alfred Adler', 'psychotherapist, 1870-1937')`
    · computeNameInitials="AA" bucket="AD" — flagged for review; not auto-touched.
- **AJ** · _leave_ — `p('A. J. Foyt', 'racing driver, b. 1935', 'A._J._Foyt')`
    · computeNameInitials="AF" bucket="AJ" — flagged for review; not auto-touched.
- **AT** · _leave_ — `p('André the Giant', 'wrestler and actor, 1946-1993')`
    · computeNameInitials="AG" bucket="AT" — flagged for review; not auto-touched.
- **BD** · _leave_ — `p('Brian De Palma', 'filmmaker, b. 1940')`
    · computeNameInitials="BP" bucket="BD" — flagged for review; not auto-touched.
- **DO** · _leave_ — `p('Daniel Ortega Saavedra', 'Nicaraguan president')`
    · computeNameInitials="DS" bucket="DO" — flagged for review; not auto-touched.
- **ER** · _leave_ — `p('Edward R. Murrow', 'journalist, 1908-1965', 'Edward_R._Murrow')`
    · computeNameInitials="EM" bucket="ER" — flagged for review; not auto-touched.
- **FI** · _leave_ — `p('Flavius Apion I.', 'leadership')`
    · computeNameInitials="FA" bucket="FI" — flagged for review; not auto-touched.
- **HG** · _leave_ — `p('H. G. Wells', 'novelist, 1866-1946', 'H._G._Wells')`
    · computeNameInitials="HW" bucket="HG" — flagged for review; not auto-touched.
- **IQ** · _leave_ — `p('I. T. Quinn', 'leadership')`
    · computeNameInitials="TQ" bucket="IQ" — flagged for review; not auto-touched.
- **JK** · _leave_ — `p('J. K. Rowling', 'novelist, b. 1965', 'J._K._Rowling')`
    · computeNameInitials="JR" bucket="JK" — flagged for review; not auto-touched.
- **JV** · _leave_ — `p('James Van Der Beek', 'actor (Dawson\'s Creek), b. 1977')`
    · computeNameInitials="JB" bucket="JV" — flagged for review; not auto-touched.
- **KN** · _leave_ — `p('Knute Rockne', 'football coach, 1888-1931')`
    · computeNameInitials="KR" bucket="KN" — flagged for review; not auto-touched.
- **LD** · _leave_ — `p('Lana Del Rey', 'singer, b. 1985')`
    · computeNameInitials="LR" bucket="LD" — flagged for review; not auto-touched.
- **ME** · _leave_ — `p('Margaret E. Knight', 'inventor, 1838-1914')`
    · computeNameInitials="MK" bucket="ME" — flagged for review; not auto-touched.
- **NU** · _leave_ — `p('Nikola Šuhaj', 'other')`
    · computeNameInitials="NS" bucket="NU" — flagged for review; not auto-touched.
- **OA** · _leave_ — `p('Omar Abdel Rahman', '')`
    · computeNameInitials="OR" bucket="OA" — flagged for review; not auto-touched.
- **OD** · _leave_ — `p('Oscar De La Hoya', '')`
    · computeNameInitials="OH" bucket="OD" — flagged for review; not auto-touched.
- **OJ** · _leave_ — `p('O. J. Simpson', 'NFL/celebrity, 1947-2024', 'O._J._Simpson')`
    · computeNameInitials="OS" bucket="OJ" — flagged for review; not auto-touched.
- **RD** · _leave_ — `p('Rebecca De Mornay', 'actress, b. 1959')`
    · computeNameInitials="RM" bucket="RD" — flagged for review; not auto-touched.
- **SV** · _leave_ — `p('Stevie Van Zandt', 'musician, b. 1950')`
    · computeNameInitials="SZ" bucket="SV" — flagged for review; not auto-touched.
- **TV** · _leave_ — `p('Thomas von Essen', '')`
    · computeNameInitials="TE" bucket="TV" — flagged for review; not auto-touched.
- **YS** · _leave_ — `p('Yves Saint Laurent', 'French fashion designer, 1936-2008')`
    · computeNameInitials="YL" bucket="YS" — flagged for review; not auto-touched.
- **ZU** · _leave_ — `p('Zlatko Šulentić', 'culture')`
    · computeNameInitials="ZS" bucket="ZU" — flagged for review; not auto-touched.
