// Outbound deep links (PRD §10, §59 "External Booking"). The app never claims to book directly.
const q = encodeURIComponent;

export function googleFlightsUrl(trip, destAirport) {
  const to = destAirport || trip.city || trip.destination;
  const from = trip.originAirport || trip.origin;
  const adults = trip.travellers > 1 ? ` for ${trip.travellers} adults` : "";
  return `https://www.google.com/travel/flights?q=${q(`Flights to ${to} from ${from} on ${trip.startDate} through ${trip.endDate}${adults}`)}`;
}

export function bookingUrl(trip, query) {
  return `https://www.booking.com/searchresults.html?ss=${q(query || trip.city)}&checkin=${trip.startDate}&checkout=${trip.endDate}&group_adults=${trip.travellers}&no_rooms=1`;
}

export function airbnbUrl(trip) {
  return `https://www.airbnb.com/s/${q(trip.city)}/homes?checkin=${trip.startDate}&checkout=${trip.endDate}&adults=${trip.travellers}`;
}

export function activityUrl(query) {
  return `https://www.getyourguide.com/s/?q=${q(query)}`;
}

export function mapsSearchUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${q(query)}`;
}

export function directionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function travelAdviceUrl(slug, section = "") {
  return `https://www.gov.uk/foreign-travel-advice/${slug}${section ? `/${section}` : ""}`;
}

export function insuranceUrl() {
  return "https://www.moneysavingexpert.com/insurance/cheap-travel-insurance/";
}

export function transferUrl(trip, airportName) {
  return `https://www.google.com/search?q=${q(`private airport transfer ${airportName} to ${trip.city}`)}`;
}

export function checkinUrl(airline) {
  return `https://www.google.com/search?q=${q(`${airline || "airline"} online check-in`)}&btnI=1`;
}
