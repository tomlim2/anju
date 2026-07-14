import {
  actionCommandTranslationSetIds,
  actionModifierTranslationSetIds
} from "./vocabulary.js";

export const RECIPE_REGISTRY_VERSION = 2;

function selector(kind, value) {
  return Object.freeze({ [kind]: value });
}

function slot(id, compositionRole, min, max, source, acceptsAnyTag, prominence) {
  return Object.freeze({
    id,
    compositionRole,
    cardinality: Object.freeze({ min, max }),
    source,
    ...(acceptsAnyTag ? { acceptsAnyTag: Object.freeze(acceptsAnyTag) } : {}),
    prominence
  });
}

export const compositionRecipes = Object.freeze([
  Object.freeze({
    id: "command",
    coherenceMode: "direct",
    blockCount: Object.freeze({ min: 2, max: 5 }),
    slots: Object.freeze([
      slot("hero", "hero", 1, 1, "lexical", ["action", "modifier"], "primary"),
      slot("subject", "support", 1, 1, "lexical", ["topic", "identity"], "secondary"),
      slot("meta", "metadata", 0, 2, "lexical", ["reference", "value"], "tertiary"),
      slot("motif", "motif", 0, 1, "graphic", null, "secondary")
    ]),
    requiredRelations: Object.freeze([
      Object.freeze({ fromSlot: "hero", relations: Object.freeze(["actsOn"]), toSlot: "subject" })
    ]),
    pairRules: Object.freeze({
      prefer: Object.freeze([
        Object.freeze({
          id: "command.target-affinity",
          from: selector("translationSetId", "upgrade.command"),
          relation: "actsOn",
          to: selector("translationSetId", "system.topic")
        })
      ]),
      avoid: Object.freeze([
        Object.freeze({
          id: "command.forest-avoid",
          from: selector("translationSetId", "upgrade.command"),
          to: selector("translationSetId", "forest.topic")
        })
      ])
    }),
    layoutPreferences: Object.freeze({
      hero: Object.freeze(["largest-viable-footprint"]),
      meta: Object.freeze(["edge", "corner"])
    })
  }),
  Object.freeze({
    id: "status",
    coherenceMode: "direct",
    blockCount: Object.freeze({ min: 2, max: 5 }),
    slots: Object.freeze([
      slot("hero", "hero", 1, 1, "lexical", ["state", "result"], "primary"),
      slot("subject", "support", 1, 1, "lexical", ["topic", "identity"], "secondary"),
      slot("recovery", "support", 0, 1, "lexical", ["action"], "secondary"),
      slot("meta", "metadata", 0, 1, "lexical", ["reference", "value"], "tertiary"),
      slot("motif", "motif", 0, 1, "graphic", null, "secondary")
    ]),
    requiredRelations: Object.freeze([
      Object.freeze({ fromSlot: "hero", relations: Object.freeze(["stateOf", "resultOf"]), toSlot: "subject" }),
      Object.freeze({
        fromSlot: "recovery",
        relations: Object.freeze(["recoveryFor"]),
        toSlot: "hero",
        whenSlotPresent: "recovery"
      })
    ]),
    pairRules: Object.freeze({
      prefer: Object.freeze([
        Object.freeze({
          id: "status.recovery-affinity",
          from: selector("tag", "action"),
          relation: "recoveryFor",
          to: selector("tag", "state")
        })
      ]),
      avoid: Object.freeze([])
    }),
    layoutPreferences: Object.freeze({
      hero: Object.freeze(["largest-viable-footprint"]),
      meta: Object.freeze(["edge", "corner"])
    })
  })
]);

export const activeRecipeIds = Object.freeze(["command", "status"]);

const commandSetIds = [
  ...actionCommandTranslationSetIds,
  ...actionModifierTranslationSetIds
].sort();
const statusSetIds = [
  "access-denied.status",
  "verified.status",
  "running.status",
  "standby.status",
  "locked.status"
];

const relationRecords = [];
for (const commandSetId of commandSetIds) {
  for (const subjectSetId of ["system.topic", "network.topic"]) {
    relationRecords.push(Object.freeze({
      id: `edge.${commandSetId}.acts-on.${subjectSetId}`,
      from: selector("translationSetId", commandSetId),
      relation: "actsOn",
      to: selector("translationSetId", subjectSetId),
      directed: true,
      reviewStatus: "approved"
    }));
  }
}
for (const statusSetId of statusSetIds) {
  for (const subjectSetId of ["system.topic", "network.topic"]) {
    relationRecords.push(Object.freeze({
      id: `edge.${statusSetId}.state-of.${subjectSetId}`,
      from: selector("translationSetId", statusSetId),
      relation: "stateOf",
      to: selector("translationSetId", subjectSetId),
      directed: true,
      reviewStatus: "approved"
    }));
  }
}
for (const statusSetId of ["access-denied.status", "locked.status"]) {
  relationRecords.push(Object.freeze({
    id: `edge.retry-command.recovery-for.${statusSetId}`,
    from: selector("translationSetId", "retry.command"),
    relation: "recoveryFor",
    to: selector("translationSetId", statusSetId),
    directed: true,
    reviewStatus: "approved"
  }));
}
for (const language of ["en", "ko", "zh"]) {
  relationRecords.push(Object.freeze({
    id: `edge.update-${language}.alternate-of.upgrade-${language}`,
    from: selector("lexicalUseId", `update.command.${language}`),
    relation: "alternateOf",
    to: selector("lexicalUseId", `upgrade.command.${language}`),
    directed: true,
    priority: 1,
    reviewStatus: "approved"
  }));
}

export const relationEdges = Object.freeze(relationRecords);

export const pilotCandidateTranslationSetIds = Object.freeze([
  ...commandSetIds,
  ...statusSetIds,
  "system.topic",
  "network.topic",
  "forest.topic",
  "retry.command"
].sort());

export const pilotCandidateTranslationSetGroups = Object.freeze([
  Object.freeze({ id: "command", ids: Object.freeze([...commandSetIds].sort()), maxActive: 2 }),
  Object.freeze({ id: "status", ids: Object.freeze([...statusSetIds].sort()), maxActive: 1 }),
  Object.freeze({ id: "subject", ids: Object.freeze(["network.topic", "system.topic"]), maxActive: 2 }),
  Object.freeze({ id: "recovery", ids: Object.freeze(["retry.command"]), maxActive: 1 })
]);

export const pilotMetadataLexicalUseIds = Object.freeze([
  "generic-code.reference.1.en",
  "generic-code.reference.2.en",
  "http-status.reference.200.en",
  "http-status.reference.404.en"
]);
