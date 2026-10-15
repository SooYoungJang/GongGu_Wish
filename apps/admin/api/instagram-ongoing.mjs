import { handleInstagramCard } from "../server/instagram-cards.mjs";
export default {
  fetch: (request) =>
    handleInstagramCard(request, process.env, { kind: "ongoing" }),
};
