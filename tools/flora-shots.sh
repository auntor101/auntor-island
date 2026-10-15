#!/bin/sh
# Takes the flora screenshot set into shots/ (dev server on :5190 serving the repo root). usage: tools/flora-shots.sh [names...]
U=http://localhost:5190/demo/flora.html
shot() { node tools/shoot.mjs "$U?$1" "shots/flora-$2.png" --size "${3:-1280x720}" ${4:-} --wait ready --delay 1000 2>&1 | grep HUD | cut -c1-260; }
for n in "$@"; do
  case $n in
    meadow) shot cam=meadow meadow;; meadowclose) shot cam=meadowclose meadow-close;; forest) shot cam=forest forest;; grove) shot cam=grove grove;; groveclose) shot cam=groveclose grove-close;;
    beach) shot cam=beach beach;; mountain) shot cam=mountain mountain;; volcano) shot cam=volcano volcano;; lake) shot cam=lake lake;; aerial) shot cam=aerial aerial;;
    autumn) shot cam=autumn autumn;; spring) shot cam=spring spring;; sunset) shot "cam=meadow&t=18" sunset;; night) shot "cam=grove&t=23" night;; snow) shot "cam=forest&snow=1" snow;;
    phone) shot cam=meadow phone 390x844 --touch;;
  esac
done
