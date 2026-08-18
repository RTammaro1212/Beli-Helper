import { v1 } from "@googlemaps/places";

import { reserveGooglePlacesRequest } from "./places-quota";

import {
    type Coordinate,
    type GooglePlace,
    type NearbySearchParameters,
    type PlacesSearchResult,
} from "./stack-schema";

type SearchNearbyRequest = NonNullable<
    Parameters<v1.PlacesClient["searchNearby"]>[0]
>;

const FOOD_AND_VENUE_TYPES = [
    "restaurant",
    "bakery",
    "bar",
    "cafe",
    "coffee_shop",
    "meal_takeaway",
    "food_court",
    "ice_cream_shop",
    "dessert_shop",
    "donut_shop",
    "bagel_shop",
    "deli",
    "sandwich_shop",
    "candy_store",
    "chocolate_shop",
    "juice_shop",
    "tea_house",
    "wine_bar",
    "brewery",
    "winery",
    "pub",
    "night_club",
    "casino",
    "hotel",
    "resort_hotel",
    "bed_and_breakfast",
    "motel",
    "inn",
    "hostel",
    "banquet_hall",
    "event_venue",
    "wedding_venue",
    "bowling_alley",
    "movie_theater",
    "amusement_park",
    "aquarium",
    "shopping_mall",
    "supermarket",
    "grocery_store",
    "market",
    "convenience_store",
    "gas_station",
    "airport",
    "train_station",
    "stadium",
    "golf_course",
    "ski_resort",
    "vineyard",
    "internet_cafe",
    "karaoke",
] as const;

const PLACE_FIELD_MASK = [
    "places.name",
    "places.id",
    "places.displayName",
    "places.types",
    "places.primaryType",
    "places.primaryTypeDisplayName",
    "places.googleMapsTypeLabel",
    "places.nationalPhoneNumber",
    "places.internationalPhoneNumber",
    "places.formattedAddress",
    "places.shortFormattedAddress",
    "places.addressComponents",
    "places.location",
    "places.viewport",
    "places.rating",
    "places.userRatingCount",
    "places.businessStatus",
    "places.priceLevel",
    "places.priceRange",
    "places.googleMapsUri",
    "places.googleMapsLinks",
    "places.websiteUri",
    "places.regularOpeningHours",
    "places.currentOpeningHours",
    "places.utcOffsetMinutes",
    "places.photos",
    "places.editorialSummary",
    "places.takeout",
    "places.delivery",
    "places.dineIn",
    "places.curbsidePickup",
    "places.reservable",
    "places.servesBreakfast",
    "places.servesLunch",
    "places.servesDinner",
    "places.servesBeer",
    "places.servesWine",
    "places.servesBrunch",
    "places.servesVegetarianFood",
    "places.servesCocktails",
    "places.servesDessert",
    "places.servesCoffee",
    "places.outdoorSeating",
    "places.liveMusic",
    "places.goodForChildren",
    "places.goodForGroups",
    "places.goodForWatchingSports",
    "places.restroom",
].join(",");

export function nearbyFoodSearchParameters(
    coordinate: Coordinate,
): NearbySearchParameters {
    return {
        languageCode: "en",
        includedTypes: [...FOOD_AND_VENUE_TYPES],
        maxResultCount: 20,
        locationRestriction: {
            circle: {
                center: coordinate,
                radius: 500,
            },
        },
        rankPreference: "DISTANCE",
        includeFutureOpeningBusinesses: false,
    };
}

export async function searchNearbyFoodPlaces(
    coordinate: Coordinate,
): Promise<PlacesSearchResult> {
    const apiKey = process.env.GOOGLE_MAPS_PLACES_API_KEY;
    if (!apiKey)
        throw new Error("GOOGLE_MAPS_PLACES_API_KEY is not configured");

    const parameters = nearbyFoodSearchParameters(coordinate);
    await reserveGooglePlacesRequest();
    const client = new v1.PlacesClient({ apiKey, fallback: true });
    const searchRequest: SearchNearbyRequest = {
        languageCode: parameters.languageCode,
        regionCode: parameters.regionCode,
        includedTypes: parameters.includedTypes,
        excludedTypes: parameters.excludedTypes,
        includedPrimaryTypes: parameters.includedPrimaryTypes,
        excludedPrimaryTypes: parameters.excludedPrimaryTypes,
        maxResultCount: parameters.maxResultCount,
        locationRestriction: parameters.locationRestriction,
        rankPreference: "DISTANCE",
        includeFutureOpeningBusinesses:
            parameters.includeFutureOpeningBusinesses,
    };

    try {
        const [response] = await client.searchNearby(searchRequest, {
            otherArgs: {
                headers: {
                    "X-Goog-FieldMask": PLACE_FIELD_MASK,
                },
            },
        });

        const places: GooglePlace[] = response.places ?? [];

        return {
            parameters,
            places,
            searchedAt: new Date().toISOString(),
        };
    } finally {
        await client.close();
    }
}
