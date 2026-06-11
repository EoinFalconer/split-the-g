import {defineBlueprint, defineDocumentFunction} from '@sanity/blueprints'

export default defineBlueprint({
  resources: [
    defineDocumentFunction({
      name: 'judge-pint',
      timeout: 60,
      event: {
        on: ['create', 'update'],
        // Fires when an attempt has an unjudged photo. Verdict fields are only
        // ever set by this function, and a rejection unsets the photo instead of
        // writing a verdict — so every patch we make falsifies this filter and
        // recursion is impossible.
        filter:
          "_type == 'attempt' && ((defined(fullPint.asset) && !defined(fullPintVerdict)) || (defined(splitPint.asset) && !defined(splitVerdict)))",
        projection:
          '{_id, "mode": coalesce(mode, "splitG"), "fullPintUrl": fullPint.asset->url, "splitPintUrl": splitPint.asset->url, "hasFullVerdict": defined(fullPintVerdict), "hasSplitVerdict": defined(splitVerdict), "playerName": player->name}',
      },
    }),
  ],
})
