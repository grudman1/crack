# Fame-floor prune log

Thresholds (drop iff ALL three fail):
- pageviews < **50000** (12mo user views)
- article_len < **5000** (bytes)
- sitelinks < **10** (wikidata interlanguage)

Entries before pass: **3006**
Entries removed: **218**
Entries after pass: **2788**

### Pageviews distribution (all entries scored) (log10 bins)

`    0…1e1  `   487  █████████████████████
`  1e1…1e2  `     3  
`  1e2…1e3  `   270  ████████████
`  1e3…1e4  `   273  ████████████
`  1e4…1e5  `   356  ████████████████
`  1e5…1e6  `   913  ████████████████████████████████████████
`  1e6…1e7  `   699  ███████████████████████████████
`  1e7…1e8  `     5  

### Article-length distribution (bytes) (log10 bins)

`    0…1e1  `   393  ███████████
`  1e2…1e3  `    15  
`  1e3…1e4  `   465  █████████████
`  1e4…1e5  `  1397  ████████████████████████████████████████
`  1e5…1e6  `   736  █████████████████████

## Top-10 highest-scoring removals (borderlines worth sanity-checking)

- **IN** `Isaac Newell` — pageviews: 21581 · article_len: 3939 · sitelinks: 4
- **YH** `Yasuo Hamanaka` — pageviews: 7914 · article_len: 2020 · sitelinks: 5
- **UK** `Udo Keppler` — pageviews: 6952 · article_len: 4596 · sitelinks: 4
- **MC** `Michelle Carter` — pageviews: 6867 · article_len: 402 · sitelinks: 1
- **NO** `Nicolai Ouroussoff` — pageviews: 6042 · article_len: 3923 · sitelinks: 0
- **SQ** `Sajjad Hussain Qureshi` — pageviews: 5832 · article_len: 4415 · sitelinks: 3
- **WL** `William Levy` — pageviews: 5804 · article_len: 428 · sitelinks: 2
- **CY** `Chris Young` — pageviews: 5294 · article_len: 1323 · sitelinks: 8
- **YE** `Yakov Gilyarievich Etinger` — pageviews: 4344 · article_len: 1665 · sitelinks: 4
- **BO** `Bill O'Reilly` — pageviews: 3702 · article_len: 611 · sitelinks: 1

## Top-10 lowest-scoring keeps (the floor)

- **CF** `Connie Francis` — pageviews: 0 · article_len: 76816 · sitelinks: 58
- **CG** `Cary Grant` — pageviews: 0 · article_len: 162807 · sitelinks: 97
- **DT** `Desmond Tutu` — pageviews: 0 · article_len: 159267 · sitelinks: 118
- **DU** `Dmitriy Ustinov` — pageviews: 0 · article_len: 31425 · sitelinks: 53
- **KH** `Katie Holmes` — pageviews: 0 · article_len: 83206 · sitelinks: 77
- **KH** `Knut Hamsun` — pageviews: 0 · article_len: 39862 · sitelinks: 134
- **LH** `Leonid Hurwicz` — pageviews: 0 · article_len: 40993 · sitelinks: 65
- **OC** `Orson Scott Card` — pageviews: 0 · article_len: 102731 · sitelinks: 56
- **OD** `Oscar De La Hoya` — pageviews: 0 · article_len: 93691 · sitelinks: 44
- **OJ** `O. J. Simpson` — pageviews: 0 · article_len: 243946 · sitelinks: 60

## All removals

### AU
- `Amir ul-Mulk` — pageviews: 926 · article_len: 2791 · sitelinks: 4
- `Afzal ul-Mulk` — pageviews: 867 · article_len: 2820 · sitelinks: 4
- `Albert A. Ultcht` — pageviews: 107 · article_len: 4627 · sitelinks: 2

### AZ
- `Alfredo Cachia Zammit` — pageviews: 212 · article_len: 1144 · sitelinks: 1

### BO
- `Bill O'Reilly` — pageviews: 3702 · article_len: 611 · sitelinks: 1

### BQ
- `Bill Quarles` — pageviews: 174 · article_len: 2060 · sitelinks: 2

### BV
- `Basilius Venantius` — pageviews: 553 · article_len: 1861 · sitelinks: 9

### BX
- `Bi Xiugu` — pageviews: 673 · article_len: 1399 · sitelinks: 2
- `Beatrice Valdez Ximénez` — pageviews: 418 · article_len: 3935 · sitelinks: 0

### CU
- `Charles H. Upton` — pageviews: 564 · article_len: 2928 · sitelinks: 5

### CX
- `Cheng Xueqi` — pageviews: 772 · article_len: 3564 · sitelinks: 3

### CY
- `Chris Young` — pageviews: 5294 · article_len: 1323 · sitelinks: 8
- `Chen Yueyi` — pageviews: 1087 · article_len: 3820 · sitelinks: 5

### DI
- `Diepold III` — pageviews: 2039 · article_len: 3029 · sitelinks: 7

### DV
- `Deusdedit of San Pietro in Vincoli` — pageviews: 1035 · article_len: 1141 · sitelinks: 5

### DX
- `Dai Xi` — pageviews: 774 · article_len: 3031 · sitelinks: 6

### EY
- `Empress Yujiulü` — pageviews: 954 · article_len: 4542 · sitelinks: 5

### FN
- `Floyd Norris` — pageviews: 1167 · article_len: 4885 · sitelinks: 2

### FR
- `François de La Rochefoucauld` — pageviews: 918 · article_len: 712 · sitelinks: 7

### FY
- `Fu Yi` — pageviews: 1273 · article_len: 2076 · sitelinks: 6
- `Fujiwara no Yasuko` — pageviews: 451 · article_len: 1882 · sitelinks: 9
- `Fu Yaoyu` — pageviews: 314 · article_len: 1795 · sitelinks: 3

### GQ
- `Greenfield Quarles` — pageviews: 1378 · article_len: 4914 · sitelinks: 2
- `Giovanni Battista Quadrone` — pageviews: 773 · article_len: 4658 · sitelinks: 4

### GU
- `George Bruce Upton` — pageviews: 169 · article_len: 4990 · sitelinks: 3
- `Guy Usher` — pageviews: 2714 · article_len: 4766 · sitelinks: 5

### GX
- `Gong Xinzhan` — pageviews: 930 · article_len: 4818 · sitelinks: 7

### GY
- `Gar Tongtsen Yulsung` — pageviews: 2450 · article_len: 4665 · sitelinks: 9

### GZ
- `Grigori Zozulya` — pageviews: 205 · article_len: 1460 · sitelinks: 1
- `Gustav J. Zittlow` — pageviews: 137 · article_len: 1938 · sitelinks: 1
- `Guy Zinn` — pageviews: 593 · article_len: 3664 · sitelinks: 5

### HU
- `Hiram A. Unruh` — pageviews: 601 · article_len: 3503 · sitelinks: 2

### HV
- `Henry del Vasto` — pageviews: 721 · article_len: 2212 · sitelinks: 5

### HY
- `H. Olin Young` — pageviews: 453 · article_len: 4444 · sitelinks: 6

### II
- `Isaiah Inman` — pageviews: 146 · article_len: 1794 · sitelinks: 1

### IN
- `Isaac Newell` — pageviews: 21581 · article_len: 3939 · sitelinks: 4

### IO
- `Igwe Okafo` — pageviews: 247 · article_len: 2562 · sitelinks: 5

### IQ
- `I. T. Quinn` — pageviews: 257 · article_len: 4130 · sitelinks: 2

### IW
- `Ivey Wingo` — pageviews: 1252 · article_len: 4683 · sitelinks: 4

### IX
- `Irene Xavier` — pageviews: 762 · article_len: 1422 · sitelinks: 4

### IY
- `Ivan Yakovlevich Yukhimenko` — pageviews: 136 · article_len: 1018 · sitelinks: 5

### JQ
- `Julian M. Quarles` — pageviews: 497 · article_len: 3764 · sitelinks: 4

### JX
- `J.U. Xavier` — pageviews: 154 · article_len: 3738 · sitelinks: 1
- `Joaquín Xaudaró` — pageviews: 535 · article_len: 4361 · sitelinks: 0

### KK
- `Karl Kraus` — pageviews: 2287 · article_len: 406 · sitelinks: 4

### KX
- `Kong Xianrong` — pageviews: 199 · article_len: 1939 · sitelinks: 3
- `Konstantinos Xenokratis` — pageviews: 411 · article_len: 2570 · sitelinks: 2

### KY
- `Kimball Young` — pageviews: 1540 · article_len: 2370 · sitelinks: 3
- `Karl Yens` — pageviews: 422 · article_len: 2839 · sitelinks: 1

### LQ
- `Lin Qiang` — pageviews: 209 · article_len: 278 · sitelinks: 1

### LU
- `Lhachen Utpala` — pageviews: 523 · article_len: 1183 · sitelinks: 1
- `Louis Uchitelle` — pageviews: 726 · article_len: 3574 · sitelinks: 3

### LZ
- `Li Zhiyi` — pageviews: 1001 · article_len: 2042 · sitelinks: 5

### MC
- `Michelle Carter` — pageviews: 6867 · article_len: 402 · sitelinks: 1

### MO
- `Mohammed Omar` — pageviews: 814 · article_len: 1989 · sitelinks: 3

### MU
- `Manuel Ugarte` — pageviews: 1569 · article_len: 260 · sitelinks: 4

### NH
- `Nizar Hamdoon` — pageviews: 1792 · article_len: 4256 · sitelinks: 3

### NI
- `Noble Edward Irwin` — pageviews: 985 · article_len: 2156 · sitelinks: 2

### NO
- `Nicolai Ouroussoff` — pageviews: 6042 · article_len: 3923 · sitelinks: 0

### NU
- `Nathaniel Gookin Upham` — pageviews: 207 · article_len: 4509 · sitelinks: 2
- `Nellie Unthank` — pageviews: 879 · article_len: 1830 · sitelinks: 1

### NY
- `Needham Yates` — pageviews: 500 · article_len: 2932 · sitelinks: 1

### OB
- `Orlando Brown` — pageviews: 2111 · article_len: 507 · sitelinks: 3

### OE
- `Oscar E. Erickson` — pageviews: 244 · article_len: 3364 · sitelinks: 2

### OI
- `Oscar Ivanissevich` — pageviews: 1127 · article_len: 2250 · sitelinks: 5
- `Otto II` — pageviews: 1650 · article_len: 1905 · sitelinks: 9

### OQ
- `Orazio Querci` — pageviews: 155 · article_len: 1657 · sitelinks: 4
- `Orestes Quintana` — pageviews: 127 · article_len: 1917 · sitelinks: 9
- `Oscar Quinlivan` — pageviews: 196 · article_len: 4158 · sitelinks: 1

### OV
- `Oscar Viñas` — pageviews: 131 · article_len: 1818 · sitelinks: 1
- `Otto A. Vogel` — pageviews: 223 · article_len: 1762 · sitelinks: 1

### OX
- `Ouyang Xiaofang` — pageviews: 304 · article_len: 2762 · sitelinks: 5

### OY
- `Oscar Youngdahl` — pageviews: 0 · article_len: 4545 · sitelinks: 5
- `Oliver Yantis` — pageviews: 0 · article_len: 2759 · sitelinks: 1

### PJ
- `Pamela Jiles` — pageviews: 200 · article_len: 218 · sitelinks: 2

### PQ
- `Percy Quin` — pageviews: 1157 · article_len: 2447 · sitelinks: 0

### QB
- `Quintín Barrientos` — pageviews: 64 · article_len: 4520 · sitelinks: 2

### QD
- `Queen Divyeshwari` — pageviews: 207 · article_len: 3055 · sitelinks: 4

### QE
- `Qiu Ersao` — pageviews: 3563 · article_len: 2273 · sitelinks: 3

### QF
- `Quirico Filopanti` — pageviews: 0 · article_len: 4144 · sitelinks: 8
- `Qazi Adnan Fareed` — pageviews: 696 · article_len: 2472 · sitelinks: 0

### QH
- `Queen Hogu` — pageviews: 453 · article_len: 1521 · sitelinks: 5

### QI
- `Qaiser Iqbal` — pageviews: 356 · article_len: 4661 · sitelinks: 2

### QJ
- `Qamar Jalalvi` — pageviews: 2225 · article_len: 2887 · sitelinks: 3

### QK
- `Qurbān-ʻAlī Khālidī` — pageviews: 419 · article_len: 3040 · sitelinks: 9
- `Qadam Kheyr` — pageviews: 3324 · article_len: 3430 · sitelinks: 3

### QL
- `Quintín Lame` — pageviews: 3217 · article_len: 3411 · sitelinks: 7

### QM
- `Queen Mojong` — pageviews: 289 · article_len: 1751 · sitelinks: 4

### QO
- `Queen Okafor` — pageviews: 946 · article_len: 2206 · sitelinks: 6
- `Quentin Orlando` — pageviews: 172 · article_len: 2831 · sitelinks: 2

### QQ
- `Quatre Sou Quatre` — pageviews: 113 · article_len: 775 · sitelinks: 3

### QS
- `Quintus Petilius Secundus` — pageviews: 729 · article_len: 1705 · sitelinks: 6
- `Quincy Shaw` — pageviews: 612 · article_len: 2906 · sitelinks: 6

### QU
- `Quanitta Underwood` — pageviews: 667 · article_len: 2598 · sitelinks: 4
- `Qurban Ali Urozgani` — pageviews: 530 · article_len: 3239 · sitelinks: 4

### QW
- `Qazi Abdul Waheed` — pageviews: 249 · article_len: 1937 · sitelinks: 5
- `Qaiser Waheed` — pageviews: 244 · article_len: 1814 · sitelinks: 2

### QX
- `Qu Xiaoming` — pageviews: 160 · article_len: 1603 · sitelinks: 4

### RC
- `Rosie Carney` — pageviews: 3522 · article_len: 2382 · sitelinks: 1

### RQ
- `Rosita Quiroga` — pageviews: 584 · article_len: 3590 · sitelinks: 9
- `Ralph P. Quarles` — pageviews: 203 · article_len: 3827 · sitelinks: 1

### RT
- `Rob Thomas` — pageviews: 2755 · article_len: 4082 · sitelinks: 0

### RU
- `Ralph E. Updike` — pageviews: 633 · article_len: 4329 · sitelinks: 4

### RV
- `Rama Varma XVII` — pageviews: 1907 · article_len: 1235 · sitelinks: 5

### RX
- `Ren Xiong` — pageviews: 2408 · article_len: 4040 · sitelinks: 9
- `Ren Xun` — pageviews: 501 · article_len: 3178 · sitelinks: 6

### RY
- `Rogelio Yrurtia` — pageviews: 625 · article_len: 3781 · sitelinks: 6

### SM
- `Susan Miller` — pageviews: 1482 · article_len: 1756 · sitelinks: 1

### SQ
- `Sajjad Hussain Qureshi` — pageviews: 5832 · article_len: 4415 · sitelinks: 3

### TN
- `Tanya Zolotoroff Nash` — pageviews: 225 · article_len: 4744 · sitelinks: 1

### TX
- `Tang Xiangming` — pageviews: 1338 · article_len: 2823 · sitelinks: 5
- `Toribio Mejía Xesspe` — pageviews: 1424 · article_len: 2703 · sitelinks: 4
- `Trần Tế Xương` — pageviews: 871 · article_len: 2206 · sitelinks: 5

### TZ
- `Tiantong Zongjue` — pageviews: 742 · article_len: 2758 · sitelinks: 3

### UB
- `Ulrich I, Bishop` — pageviews: 274 · article_len: 2375 · sitelinks: 3

### UC
- `Uke Clanton` — pageviews: 209 · article_len: 2381 · sitelinks: 2
- `Ulric L. Crocker` — pageviews: 0 · article_len: 2406 · sitelinks: 2

### UF
- `Ursa Louis Freed` — pageviews: 139 · article_len: 2165 · sitelinks: 1

### UG
- `Ulv Galiciefarer` — pageviews: 1318 · article_len: 3846 · sitelinks: 4

### UH
- `Ulrich Hemmi` — pageviews: 90 · article_len: 1458 · sitelinks: 1
- `Uriel Sebree Hall` — pageviews: 666 · article_len: 3182 · sitelinks: 5

### UK
- `Udo Keppler` — pageviews: 6952 · article_len: 4596 · sitelinks: 4

### UN
- `Uriel Nespoli` — pageviews: 232 · article_len: 1987 · sitelinks: 3

### UO
- `Ulman Owens` — pageviews: 708 · article_len: 3341 · sitelinks: 1
- `Uncle Charlie Osborne` — pageviews: 1461 · article_len: 4319 · sitelinks: 1

### UP
- `Ulysses Grant Baker Pierce` — pageviews: 307 · article_len: 2483 · sitelinks: 1
- `Urbane Pickering` — pageviews: 394 · article_len: 3074 · sitelinks: 2

### UR
- `Ulysses Ricci` — pageviews: 621 · article_len: 3909 · sitelinks: 4
- `Ulisse Ribustini` — pageviews: 164 · article_len: 3599 · sitelinks: 3
- `Umberto Ravetta` — pageviews: 165 · article_len: 2267 · sitelinks: 5

### US
- `Ulysses S. Stone` — pageviews: 678 · article_len: 4153 · sitelinks: 5

### UV
- `Uriele Vitolo` — pageviews: 135 · article_len: 2823 · sitelinks: 1

### UX
- `Uanhenga Xitu` — pageviews: 831 · article_len: 2822 · sitelinks: 7

### UY
- `Uraji Yamakawa` — pageviews: 844 · article_len: 4440 · sitelinks: 5
- `Utagawa Yoshifuji` — pageviews: 1160 · article_len: 1677 · sitelinks: 4

### VI
- `Vernon K. Irvine` — pageviews: 255 · article_len: 3872 · sitelinks: 1

### VO
- `Venantius Opilio` — pageviews: 589 · article_len: 3999 · sitelinks: 7

### VQ
- `Víctor Guardia Quirós` — pageviews: 111 · article_len: 1471 · sitelinks: 3

### VT
- `Victor Tchetchet` — pageviews: 733 · article_len: 3285 · sitelinks: 0

### VU
- `Viktor Utgof` — pageviews: 485 · article_len: 4511 · sitelinks: 2

### VV
- `Valgarðr á Velli` — pageviews: 325 · article_len: 4477 · sitelinks: 5
- `Valentín Vergara` — pageviews: 133 · article_len: 2848 · sitelinks: 4

### VY
- `Victor Yarros` — pageviews: 1278 · article_len: 3738 · sitelinks: 6

### VZ
- `Victor Zednick` — pageviews: 165 · article_len: 3221 · sitelinks: 1
- `Valentina Zimina` — pageviews: 0 · article_len: 4487 · sitelinks: 4

### WL
- `William Levy` — pageviews: 5804 · article_len: 428 · sitelinks: 2

### WQ
- `William Edward Quine` — pageviews: 342 · article_len: 4235 · sitelinks: 0

### WU
- `Willard Uphaus` — pageviews: 518 · article_len: 4036 · sitelinks: 1

### WX
- `Wu Xun` — pageviews: 1654 · article_len: 4254 · sitelinks: 5

### WY
- `Willis Young` — pageviews: 210 · article_len: 2873 · sitelinks: 1

### XA
- `Xavier Anchetti` — pageviews: 290 · article_len: 4713 · sitelinks: 2

### XC
- `Xavier Coppolani` — pageviews: 2597 · article_len: 4056 · sitelinks: 7

### XD
- `Xavier Downwind` — pageviews: 464 · article_len: 2791 · sitelinks: 2

### XF
- `Xu Fulin` — pageviews: 0 · article_len: 1948 · sitelinks: 3

### XG
- `X. Henry Goodnough` — pageviews: 182 · article_len: 2464 · sitelinks: 1

### XH
- `Xenophon Huddy` — pageviews: 123 · article_len: 4748 · sitelinks: 1
- `Xavier Haegy` — pageviews: 185 · article_len: 1711 · sitelinks: 8

### XI
- `Xenophont Ivanov` — pageviews: 172 · article_len: 2395 · sitelinks: 3
- `Xoana Iacoi` — pageviews: 214 · article_len: 2454 · sitelinks: 5

### XK
- `Xiong Kang` — pageviews: 333 · article_len: 2073 · sitelinks: 8

### XL
- `Xu Ling` — pageviews: 0 · article_len: 1683 · sitelinks: 7

### XN
- `Xhemal Naipi` — pageviews: 480 · article_len: 3990 · sitelinks: 3

### XQ
- `Xiong Qu` — pageviews: 543 · article_len: 2147 · sitelinks: 9
- `Xia Qin` — pageviews: 220 · article_len: 1213 · sitelinks: 3

### XR
- `Xiang Rong` — pageviews: 2684 · article_len: 2803 · sitelinks: 5

### XS
- `Xiong Sheng` — pageviews: 476 · article_len: 1501 · sitelinks: 9
- `Xantippe Saunders` — pageviews: 707 · article_len: 3697 · sitelinks: 3

### XT
- `Xu Tingyao` — pageviews: 904 · article_len: 4774 · sitelinks: 3

### XU
- `Xavier Ubeira` — pageviews: 208 · article_len: 986 · sitelinks: 2
- `Xaver Unsinn` — pageviews: 818 · article_len: 4324 · sitelinks: 8

### XV
- `Xavier Veyrat` — pageviews: 84 · article_len: 2553 · sitelinks: 0

### XW
- `Xenophon P. Wilfley` — pageviews: 1527 · article_len: 4676 · sitelinks: 0

### XX
- `Xu Xiuzhi` — pageviews: 417 · article_len: 4650 · sitelinks: 3

### XY
- `Xiong Yang` — pageviews: 422 · article_len: 1510 · sitelinks: 9
- `Xu Yuanquan` — pageviews: 871 · article_len: 2987 · sitelinks: 4

### XZ
- `Xiong Zhi` — pageviews: 430 · article_len: 2670 · sitelinks: 8
- `Xiao Zisheng` — pageviews: 2519 · article_len: 4371 · sitelinks: 4

### YC
- `Yuchi Chifan` — pageviews: 1078 · article_len: 4019 · sitelinks: 5

### YE
- `Yevgeny Edelson` — pageviews: 172 · article_len: 2455 · sitelinks: 4
- `Yakov Eshpai` — pageviews: 482 · article_len: 1351 · sitelinks: 7
- `Yakov Gilyarievich Etinger` — pageviews: 4344 · article_len: 1665 · sitelinks: 4

### YF
- `Yosafat Fedoryk` — pageviews: 216 · article_len: 4199 · sitelinks: 3
- `Yuliy Firtsak` — pageviews: 249 · article_len: 2626 · sitelinks: 8

### YG
- `Yitzhak Gitterman` — pageviews: 813 · article_len: 2431 · sitelinks: 4

### YH
- `Yasuo Hamanaka` — pageviews: 7914 · article_len: 2020 · sitelinks: 5
- `Yuri Hasenko` — pageviews: 974 · article_len: 4077 · sitelinks: 5
- `Yevhen Holitsynsky` — pageviews: 222 · article_len: 3865 · sitelinks: 3

### YI
- `Yevgeni Ivanov-Barkov` — pageviews: 182 · article_len: 1484 · sitelinks: 7
- `Yadanabon I` — pageviews: 490 · article_len: 3418 · sitelinks: 0

### YJ
- `Youngy Johnson` — pageviews: 0 · article_len: 2171 · sitelinks: 2
- `Yuri Nikolayevich Jobbers` — pageviews: 0 · article_len: 2660 · sitelinks: 3

### YN
- `Yevhen Neronovych` — pageviews: 663 · article_len: 4170 · sitelinks: 4
- `Yenovk Nazarian` — pageviews: 255 · article_len: 2469 · sitelinks: 4

### YO
- `Yip Owens` — pageviews: 259 · article_len: 2500 · sitelinks: 4
- `Young Jack O'Brien` — pageviews: 489 · article_len: 2105 · sitelinks: 3

### YP
- `Yulian Pelesh` — pageviews: 395 · article_len: 4043 · sitelinks: 6
- `Yank Porter` — pageviews: 157 · article_len: 1272 · sitelinks: 2

### YU
- `Yoichi Ueno` — pageviews: 460 · article_len: 1990 · sitelinks: 4

### YV
- `Yakov Vilner` — pageviews: 617 · article_len: 2374 · sitelinks: 8

### YW
- `Yoav Yehoshua Weingarten` — pageviews: 461 · article_len: 2001 · sitelinks: 3

### YX
- `Yu Xingwu` — pageviews: 368 · article_len: 2191 · sitelinks: 3

### YY
- `Yuchi Yiseng` — pageviews: 680 · article_len: 3482 · sitelinks: 9
- `Yuan Ye` — pageviews: 320 · article_len: 790 · sitelinks: 1

### ZI
- `Zinaida Ivanova` — pageviews: 502 · article_len: 4260 · sitelinks: 9
- `Zeynab Ilhamy` — pageviews: 1261 · article_len: 4012 · sitelinks: 6

### ZJ
- `Zhou Jichang` — pageviews: 706 · article_len: 2163 · sitelinks: 5

### ZK
- `Zedekiah Kidwell` — pageviews: 405 · article_len: 3998 · sitelinks: 5

### ZL
- `Zhen Luan` — pageviews: 597 · article_len: 2856 · sitelinks: 8

### ZN
- `Zipp Newman` — pageviews: 398 · article_len: 3766 · sitelinks: 2
- `Zachariah C. Neahr` — pageviews: 223 · article_len: 3238 · sitelinks: 1

### ZO
- `Zacheus Chukwukaelo Obi` — pageviews: 219 · article_len: 1629 · sitelinks: 2

### ZQ
- `Zeng Qi` — pageviews: 3192 · article_len: 966 · sitelinks: 8

### ZU
- `Zhanna Usenko-Chorna` — pageviews: 235 · article_len: 2318 · sitelinks: 5

### ZV
- `Zachary A. Vane` — pageviews: 277 · article_len: 3776 · sitelinks: 2

### ZW
- `Zack Whyte` — pageviews: 779 · article_len: 1622 · sitelinks: 5
- `Zadoc L. Weatherford` — pageviews: 676 · article_len: 3563 · sitelinks: 5

### ZX
- `Zhou Xuexi` — pageviews: 983 · article_len: 4436 · sitelinks: 5

### ZZ
- `Zhan Ziqian` — pageviews: 1654 · article_len: 2591 · sitelinks: 8

## Pairs left empty after the prune

QD, YJ
