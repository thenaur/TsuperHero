// Presentation Layer: Visual asset paths and UI layout offsets keyed by Domain IDs.
// Keeping image paths and CSS pixel offsets here keeps js/domain/data.js 100% UI-free.

export const DEFAULT_ROAD_LOOP_SRC = '../assets/RoadLoop.gif';
export const DEFAULT_INTERIOR_SRC = '../assets/JeepInterior.png';
export const CUSTOM_PREVIEW_NORMAL = '../assets/customization/NormalPreview.png';
export const LOCK_ICON_SRC = '../assets/Lock.png';

export const STOP_BACKGROUNDS = {
  Jollibee: '../assets/resto.png',
  Palengke: '../assets/palengke.png',
  Munisipyo: '../assets/munisipyo.png',
  Hospital: '../assets/hospital.png',
  School: '../assets/school.png',
  Terminal: '../assets/resto.png',
};

export const CUSTOM_ASSETS = {
  'decor-dice': {
    icon: '../assets/customization/decor/DecorFuzzyDice.png',
    preview: '../assets/customization/decor/DicePreview.png',
    decorImg: '../assets/customization/decor/DecoreFuzzyDiceActual.png',
  },
  'decor-freshener': {
    icon: '../assets/customization/decor/DecorAirFreshener.png',
    preview: '../assets/customization/decor/AirFreshPreview.png',
    decorImg: '../assets/customization/decor/DecorAirFreshenerActual.png',
  },
  'decor-lily': {
    icon: '../assets/customization/decor/DecorLilyValley.png',
    preview: '../assets/customization/decor/LilyPreview.png',
    decorImg: '../assets/customization/decor/DecorLilyValleyActual.png',
  },
  'interior-fiesta': {
    icon: '../assets/customization/interior/IconFiesta.png',
    preview: '../assets/customization/interior/FiestaPreview.png',
    interiorImg: '../assets/customization/interior/JeepInteriorFiesta.png',
    sideTabsTop: 114,
  },
  'interior-christmas': {
    icon: '../assets/customization/interior/IconChristmas.png',
    preview: '../assets/customization/interior/ChristmasPreview.png',
    interiorImg: '../assets/customization/interior/JeepInteriorChristmas.png',
    sideTabsTop: 78,
  },
  'interior-newyear': {
    icon: '../assets/customization/interior/IconNewYear.png',
    preview: '../assets/customization/interior/NewYearPreview.png',
    interiorImg: '../assets/customization/interior/JeepInteriorNewYear.png',
    sideTabsTop: 78,
  },
  'scenery-morning': {
    icon: '../assets/customization/morning/IconMorning.png',
    preview: '../assets/customization/morning/PreviewMorning.png',
    roadGif: '../assets/customization/morning/RoadLoopMorning.gif',
    stopBackgrounds: {
      Jollibee: '../assets/customization/morning/RestoMorning.png',
      Palengke: '../assets/customization/morning/PalengkeMorning.png',
      Munisipyo: '../assets/customization/morning/MunisipyoMorning.png',
      Hospital: '../assets/customization/morning/HospitalMorning.png',
      School: '../assets/customization/morning/SchoolMorning.png',
      Terminal: '../assets/customization/morning/RestoMorning.png',
    },
  },
  'scenery-night': {
    icon: '../assets/customization/night/IconNight.png',
    preview: '../assets/customization/night/PreviewNight.png',
    roadGif: '../assets/customization/night/RoadloopNight.gif',
    stopBackgrounds: {
      Jollibee: '../assets/customization/night/RestoNight.png',
      Palengke: '../assets/customization/night/PalengkeNight.png',
      Munisipyo: '../assets/customization/night/MunisipyoNight.png',
      Hospital: '../assets/customization/night/HospitalNight.png',
      School: '../assets/customization/night/SchoolNight.png',
      Terminal: '../assets/customization/night/RestoNight.png',
    },
  },
  'scenery-dawn': {
    icon: '../assets/customization/dawn/IconDawn.png',
    preview: '../assets/customization/dawn/PreviewDawn.png',
    roadGif: '../assets/customization/dawn/RoadLoopDawn.gif',
    stopBackgrounds: {
      Jollibee: '../assets/customization/dawn/RestoDawn.png',
      Palengke: '../assets/customization/dawn/PalengkeDawn.png',
      Munisipyo: '../assets/customization/dawn/MunisipyoDawn.png',
      Hospital: '../assets/customization/dawn/HospitalDawn.png',
      School: '../assets/customization/dawn/SchoolDawn.png',
      Terminal: '../assets/customization/dawn/RestoDawn.png',
    },
  },
};

export const getCustomAssets = (itemId) => CUSTOM_ASSETS[itemId] || {};
