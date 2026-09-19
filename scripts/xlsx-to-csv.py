#!/usr/bin/env python3
"""Export the Routes and Stations sheets of the workbook as CSV fixtures.

An xlsx is a zip of XML. xl/workbook.xml names the sheets, its rels file maps each
name to a part, xl/sharedStrings.xml holds every string, and each cell carries either
a shared-string index or a literal. A formula cell also carries the value Excel last
computed, which is the number the fixtures need.

Standard library only, so the seed and the tests share one export with no dependency.
"""

import csv
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"

ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT / "Hiking_database_Bucharest_rail.xlsx"
OUT = ROOT / "prisma" / "fixtures"

# Route 135 starts and finishes at Breaza, which the Stations sheet does not list, so the
# sheet's own MATCH fell through to 0 and that row understates the day by two train
# journeys. Breaza is 1.50 h from Bucuresti Nord, between Campina at 1.2 and Posada at 1.6
# on the same line. The user settled this on 2026-09-19. The note column stays empty:
# whether the fast trains stop there is not established.
BREAZA = ["Breaza", "1.50", "0", "M300", ""]
BREAZA_AFTER = "Campina"


def column(ref):
    """The zero-based column of a cell reference such as AB12."""
    index = 0
    for letter in re.match("[A-Z]+", ref).group():
        index = index * 26 + ord(letter) - 64
    return index - 1


def read_sheet(book, part, strings):
    """Every non-empty row of a sheet, as lists of strings.

    A cell may omit its reference, in which case it follows the previous one.
    """
    rows = []
    for row in ET.fromstring(book.read(part)).iter(NS + "row"):
        cells = {}
        following = 0
        for cell in row.iter(NS + "c"):
            ref = cell.get("r")
            index = column(ref) if ref else following
            following = index + 1
            value = cell.find(NS + "v")
            inline = cell.find(NS + "is")
            if cell.get("t") == "s" and value is not None:
                cells[index] = strings[int(value.text)]
            elif inline is not None:
                cells[index] = "".join(t.text or "" for t in inline.iter(NS + "t"))
            else:
                cells[index] = value.text if value is not None else ""
        if cells:
            rows.append([cells.get(i, "") for i in range(max(cells) + 1)])
    return rows


def sheet_parts(book):
    """Sheet name to the part that holds it."""
    targets = {
        rel.get("Id"): rel.get("Target")
        for rel in ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
    }
    return {
        sheet.get("name"): "xl/" + targets[sheet.get(RID)].lstrip("/")
        for sheet in ET.fromstring(book.read("xl/workbook.xml")).iter(NS + "sheet")
    }


def padded(rows, width):
    return [row + [""] * (width - len(row)) for row in rows]


def write(path, rows):
    with path.open("w", newline="", encoding="utf-8") as handle:
        csv.writer(handle).writerows(rows)


def main():
    with zipfile.ZipFile(BOOK) as book:
        strings = [
            "".join(t.text or "" for t in si.iter(NS + "t"))
            for si in ET.fromstring(book.read("xl/sharedStrings.xml")).iter(NS + "si")
        ]
        parts = sheet_parts(book)
        routes = read_sheet(book, parts["Routes"], strings)
        stations = read_sheet(book, parts["Stations"], strings)

    routes = padded(routes, len(routes[0]))

    # The last row of the Stations sheet is a footnote in the first column, not a station.
    header, body = stations[0], [row for row in stations[1:] if len(row) > 1]
    body = padded(body, len(header))
    body.insert([row[0] for row in body].index(BREAZA_AFTER) + 1, BREAZA)

    OUT.mkdir(parents=True, exist_ok=True)
    write(OUT / "routes.csv", routes)
    write(OUT / "stations.csv", [header] + body)

    print(f"routes.csv   {len(routes) - 1} rows, {len(routes[0])} columns")
    print(f"stations.csv {len(body)} rows, {len(header)} columns")


if __name__ == "__main__":
    main()
