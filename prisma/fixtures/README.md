# Seed fixtures

Where each file came from, because two of them carry OpenStreetMap data and rule 5 of
`CLAUDE.md` says that has to stay separable from the user's own work.

| File | Rows | Source |
| --- | --- | --- |
| `routes.csv` | 185 | The Routes sheet of `Hiking_database_Bucharest_rail.xlsx`, all 33 columns, exported by `scripts/xlsx-to-csv.py` |
| `stations.csv` | 31 | The Stations sheet, 30 rows, plus Breaza which the sheet omits |
| `route-names.csv` | 185 | Romanian diacritics restored on the route names. Word level, so a correction is one line |
| `station-points.csv` | 31 | Coordinates. 30 from OpenStreetMap, 1 approximate |
| `route-massif.csv` | 185 | Which of the 15 massifs each route belongs to |
| `massifs.csv` | 15 | Polygons. 5 from OpenStreetMap, 10 drawn |

## Licence

Every row of `massifs.csv` and `station-points.csv` carries its own `source` and
`licence`. Rows marked `osm` and `odbl` are derived from OpenStreetMap and are ODbL:
attribution is required on any page that shows them. Rows marked `drawn` and `own` are
this project's own work. The two never merge into one column, which is the whole point of
rule 5.

## The five real polygons

Romania has no mountain range boundaries in OpenStreetMap. Ten elements in the entire
country are tagged `natural=mountain_range` and they are Carpathian-scale divisions. What
does exist is Natura 2000 and park boundaries, which follow massif outlines closely, so
five massifs take theirs from those relations:

| Massif | OSM relation | Area | Cross-check |
| --- | --- | --- | --- |
| Bucegi | 2196558 | 388 km2 | Bucegi Natural Park is about 326 km2 |
| Făgăraș | 2201635 | 1986 km2 | the Natura 2000 site is 1985 km2 |
| Piatra Craiului | 2196572 | 159 km2 | the national park is 148 km2 |
| Piatra Mare | 2196608 | 43 km2 | |
| Comana | 13655462 | 241 km2 | Comana Natural Park |

Each arrives as unordered way fragments at metre precision and is rebuilt by PostGIS with
`ST_Node`, `ST_Polygonize`, `ST_MakeValid` and `ST_SimplifyPreserveTopology` at 0.004
degrees, roughly 400 m, because a massif shade on a country map does not need 9329 points.
A hand-rolled stitcher was tried first and produced a self-intersecting Făgăraș, so it was
thrown away.

The relation named `Leaota` is **not** used. It is a 14 km2 Natura 2000 site inside a
massif of several hundred, and shading the massif with it would be wrong.

## The ten drawn polygons

Baiului, Postăvaru, Perșani, Ciucaș, Siriu, Slănic Prahova, Dealurile Prahovei,
Clăbucetele Întorsurii, Leaota and Nordul Bucureștiului have no boundary in any source.
They are coarse outlines of five or six points drawn from known extents: a shade, not a
survey. **Correct these first.** They are the rows where nobody has checked anything.

## Two entities the spreadsheet does not have

The sheet's `Bucegi west` folds into `Bucegi`. It is Pietroșița into the Ialomița valley,
Padina, Peștera, Cheile Tătarului and Cheile Zănoagei, which are western Bucegi, and the
OpenStreetMap relations cross the split, so it was an artefact of the spreadsheet.

The sheet's `Bucharest area` splits in two. Comana is 50 km south of the city and Mogoșoaia
and Buftea are north of it, so one polygon would have had to swallow Bucharest.

## Săcele

`station-points.csv` has one row marked `drawn`. Săcele has no station node in
OpenStreetMap: the Brașov to Întorsura line is mapped as Dârste, Budila, Teliu, Valea
Teliului, Poiana Florilor, Întorsura Buzăului, and nothing under Satulung, Turcheș, Cernatu
or Bunloc either. The coordinate is approximate and the row says so in its note.
