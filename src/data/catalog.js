import {
  Plane, Car, BedDouble, Utensils, Landmark, Castle, Umbrella, Sailboat, Mountain,
  Martini, ShoppingBag, Stethoscope, Flower2, Camera, Coffee, Luggage, Sparkles, Footprints,
} from "lucide-react";

// Each category maps to an icon and one of the theme hues in styles.css (--c-*).
export const CATEGORIES = {
  flight: { label: "Flight", icon: Plane, hue: "ink", emoji: "✈️" },
  transport: { label: "Transport", icon: Car, hue: "slate", emoji: "🚕" },
  stay: { label: "Stay", icon: BedDouble, hue: "slate", emoji: "🏨" },
  food: { label: "Food", icon: Utensils, hue: "sun", emoji: "🍴" },
  cafe: { label: "Café", icon: Coffee, hue: "sun", emoji: "☕" },
  culture: { label: "Culture", icon: Landmark, hue: "plum", emoji: "🏛️" },
  history: { label: "History", icon: Castle, hue: "plum", emoji: "📜" },
  beach: { label: "Beach", icon: Umbrella, hue: "sea", emoji: "🏖️" },
  water: { label: "Water", icon: Sailboat, hue: "sea", emoji: "🚤" },
  adventure: { label: "Adventure", icon: Mountain, hue: "coral", emoji: "🪂" },
  nightlife: { label: "Nightlife", icon: Martini, hue: "night", emoji: "🌃" },
  shopping: { label: "Shopping", icon: ShoppingBag, hue: "coral", emoji: "🛍️" },
  dental: { label: "Dental", icon: Stethoscope, hue: "sea", emoji: "🦷" },
  wellness: { label: "Wellness", icon: Flower2, hue: "sea", emoji: "🧘" },
  photography: { label: "Photo", icon: Camera, hue: "plum", emoji: "📸" },
  hiking: { label: "Hiking", icon: Footprints, hue: "coral", emoji: "🥾" },
  packing: { label: "Prep", icon: Luggage, hue: "slate", emoji: "🧳" },
  free: { label: "Free time", icon: Sparkles, hue: "slate", emoji: "✨" },
};

export const cat = (id) => CATEGORIES[id] || CATEGORIES.free;

export const INTERESTS = [
  { id: "beach", label: "Beaches", emoji: "🏖️" },
  { id: "adventure", label: "Adventure", emoji: "🪂" },
  { id: "food", label: "Food", emoji: "🍴" },
  { id: "history", label: "History", emoji: "🏛️" },
  { id: "culture", label: "Culture", emoji: "🎨" },
  { id: "nightlife", label: "Nightlife", emoji: "🌃" },
  { id: "water", label: "Water sports", emoji: "🚤" },
  { id: "shopping", label: "Shopping", emoji: "🛍️" },
  { id: "wellness", label: "Wellness", emoji: "🧘" },
  { id: "dental", label: "Dental care", emoji: "🦷" },
  { id: "photography", label: "Photography", emoji: "📸" },
  { id: "hiking", label: "Hiking", emoji: "🥾" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧" },
];

export const PARTIES = [
  { id: "solo", label: "Solo", emoji: "🧳", count: 1 },
  { id: "partner", label: "Partner", emoji: "💑", count: 2 },
  { id: "friends", label: "Friends", emoji: "👯", count: 3 },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧", count: 4 },
  { id: "business", label: "Business", emoji: "💼", count: 1 },
];

export const STAY_TYPES = [
  { id: "hotel", label: "Hotel" },
  { id: "rental", label: "Airbnb / rental" },
  { id: "resort", label: "Resort" },
  { id: "hostel", label: "Hostel" },
];

export const TRANSFER_MODES = [
  { id: "private", label: "Private transfer", note: "Driver meets you in arrivals — best for late arrivals." },
  { id: "taxi", label: "Airport taxi", note: "Use the official rank outside arrivals and agree the fare first." },
  { id: "ride", label: "Ride-hailing app", note: "Check local availability before you fly." },
  { id: "rental", label: "Rental car", note: "Bring your licence and check if an IDP is required." },
  { id: "public", label: "Public transport", note: "Cheapest; check last-service times for late flights." },
];

// Checklist template (PRD §14). `link` ties an item to trip state so both stay in sync.
export const CHECKLIST_TEMPLATE = [
  { id: "passport", label: "Passport valid for the whole trip", group: "Documents", essential: true },
  { id: "visa", label: "Visa / entry requirements checked", group: "Documents", essential: true },
  { id: "flight", label: "Flight booked", group: "Documents", essential: true, link: "flight" },
  { id: "hotel", label: "Accommodation booked", group: "Documents", essential: true, link: "stay" },
  { id: "insurance", label: "Travel insurance", group: "Documents", essential: true },
  { id: "licence", label: "Driving licence (if renting a car)", group: "Documents" },
  { id: "currency", label: "Local currency / cash", group: "Money", essential: true },
  { id: "cards", label: "Debit / credit card that works abroad", group: "Money" },
  { id: "bank", label: "Notify bank if needed", group: "Money" },
  { id: "transfer", label: "Airport transfer arranged", group: "Transport", essential: true, link: "transfer" },
  { id: "localtransport", label: "Local transport plan", group: "Transport" },
  { id: "clothes", label: "Weather-appropriate clothes", group: "Packing" },
  { id: "swimwear", label: "Swimwear", group: "Packing" },
  { id: "nightout", label: "Night-out outfit", group: "Packing" },
  { id: "adapter", label: "Travel adapter", group: "Electronics" },
  { id: "charger", label: "Phone charger & power bank", group: "Electronics" },
  { id: "meds", label: "Medication & prescriptions", group: "Health" },
  { id: "firstaid", label: "First-aid basics", group: "Health" },
  { id: "activities", label: "Key activities booked", group: "Activities" },
  { id: "restaurants", label: "Restaurant reservations", group: "Activities" },
  { id: "checkin", label: "Online flight check-in", group: "Flight", essential: true, link: "checkin" },
];
