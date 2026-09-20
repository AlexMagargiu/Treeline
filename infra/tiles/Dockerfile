# The tile toolbox. Nothing here is installed on a developer machine or on the box.
#
# gdal, gdal_contour and gdalwarp come from the pinned OSGeo image. tippecanoe and
# rio-rgbify have no maintained published image: felt/tippecanoe ships source releases
# only, and the one image on Docker Hub is unpinned, years old and cannot write PMTiles.
# So both are built here from pinned versions, and the pin lives in a checked-in file
# rather than in a tag somebody else can move.

FROM ghcr.io/osgeo/gdal:ubuntu-small-3.13.3

ARG TIPPECANOE_VERSION=2.79.0
ARG RIO_RGBIFY_VERSION=0.4.0

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential \
      ca-certificates \
      git \
      libsqlite3-dev \
      python3-pip \
      zlib1g-dev \
 && git clone --depth 1 --branch "${TIPPECANOE_VERSION}" \
      https://github.com/felt/tippecanoe.git /tmp/tippecanoe \
 && make -C /tmp/tippecanoe -j"$(nproc)" \
 && make -C /tmp/tippecanoe install \
 && rm -rf /tmp/tippecanoe \
 && pip3 install --no-cache-dir --break-system-packages \
      "rio-rgbify==${RIO_RGBIFY_VERSION}" \
 && rm -rf /var/lib/apt/lists/*

# rio-rgbify asks rasterio to reproject a tile's bounds to EPSG:4326 with densify_pts=0.
# GDAL refuses that: a geographic target needs at least 2 densification points, because a
# straight line in web mercator is a curve in degrees. Every tile raises
# "densify_pts must be at least 2 if the output is geograpic" and no terrain is written.
#
# The package is dead upstream: mapbox/rio-rgbify last had a real commit in 2023, 0.4.0 is
# the final PyPI release, and the one maintained fork is archived. Pinning older versions
# does not help, because the refusal is in GDAL, not in rasterio: rasterio 1.3.11 with
# GDAL 3.9.2 fails in exactly the same way. Measured, both of them.
#
# So the kwarg is dropped here, which is what the archived fork did. rasterio then uses its
# default of 21 points, and the bounds come out slightly larger and more correct rather
# than less. The grep either side makes the build fail loudly if upstream ever fixes this
# and the line stops matching, instead of silently patching nothing.
RUN RGBIFY_DIR="$(python3 -c 'import rio_rgbify, pathlib; print(pathlib.Path(rio_rgbify.__file__).parent)')" \
 && grep -q ', densify_pts=0)' "$RGBIFY_DIR/mbtiler.py" \
 && sed -i 's/, densify_pts=0)/)/' "$RGBIFY_DIR/mbtiler.py" \
 && ! grep -q 'densify_pts=0' "$RGBIFY_DIR/mbtiler.py"

WORKDIR /work
