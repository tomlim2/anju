import {
  actionCommandTranslationSetIds,
  actionModifierTranslationSetIds
} from "./vocabulary.js";

export const RECIPE_REGISTRY_VERSION = 4;

function selector(kind, value) {
  return Object.freeze({ [kind]: value });
}

function slot(id, compositionRole, min, max, source, acceptsAnyTag, prominence, optionalPresenceRate = null) {
  return Object.freeze({
    id,
    compositionRole,
    cardinality: Object.freeze({ min, max }),
    source,
    ...(acceptsAnyTag ? { acceptsAnyTag: Object.freeze(acceptsAnyTag) } : {}),
    ...(optionalPresenceRate === null ? {} : { optionalPresenceRate }),
    prominence
  });
}

export const compositionRecipes = Object.freeze([
  Object.freeze({
    id: "command",
    coherenceMode: "direct",
    blockCount: Object.freeze({ min: 2, max: 5 }),
    slots: Object.freeze([
      slot("hero", "hero", 1, 1, "lexical", ["action"], "primary"),
      slot("modifier", "support", 0, 1, "lexical", ["modifier"], "secondary", 0.25),
      slot("subject", "support", 1, 1, "lexical", ["topic", "identity"], "secondary"),
      slot("meta", "metadata", 0, 2, "lexical", ["reference", "value"], "tertiary"),
      slot("motif", "motif", 0, 1, "graphic", null, "secondary")
    ]),
    requiredRelations: Object.freeze([
      Object.freeze({ fromSlot: "hero", relations: Object.freeze(["actsOn"]), toSlot: "subject" }),
      Object.freeze({
        fromSlot: "modifier",
        relations: Object.freeze(["modifies"]),
        toSlot: "hero",
        whenSlotPresent: "modifier"
      })
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
  ...actionCommandTranslationSetIds
].sort();
const modifierSetIds = [...actionModifierTranslationSetIds].sort();
const statusSetIds = [
  "access-denied.status",
  "verified.status",
  "running.status",
  "standby.status",
  "locked.status"
];

const REVIEWED_COMMAND_SUBJECTS = Object.freeze({
  "break.command": Object.freeze(["system.topic"]),
  "bring.command": Object.freeze(["system.topic"]),
  "burn.command": Object.freeze(["system.topic"]),
  "buy.command": Object.freeze(["system.topic"]),
  "call.command": Object.freeze(["network.topic", "system.topic"]),
  "change.command": Object.freeze(["system.topic"]),
  "charge.command": Object.freeze(["system.topic"]),
  "check.command": Object.freeze(["network.topic", "system.topic"]),
  "click.command": Object.freeze(["network.topic", "system.topic"]),
  "code.command": Object.freeze(["system.topic"]),
  "crack.command": Object.freeze(["network.topic", "system.topic"]),
  "cross.command": Object.freeze(["system.topic"]),
  "cut.command": Object.freeze(["system.topic"]),
  "drag-and-drop.command": Object.freeze(["system.topic"]),
  "erase.command": Object.freeze(["system.topic"]),
  "fax.command": Object.freeze(["network.topic"]),
  "fill.command": Object.freeze(["system.topic"]),
  "find.command": Object.freeze(["network.topic", "system.topic"]),
  "fix.command": Object.freeze(["system.topic"]),
  "format.command": Object.freeze(["system.topic"]),
  "jam.command": Object.freeze(["network.topic"]),
  "leave.command": Object.freeze(["system.topic"]),
  "load.command": Object.freeze(["network.topic", "system.topic"]),
  "lock.command": Object.freeze(["network.topic", "system.topic"]),
  "mail.command": Object.freeze(["network.topic"]),
  "name.command": Object.freeze(["system.topic"]),
  "paste.command": Object.freeze(["system.topic"]),
  "pause.command": Object.freeze(["system.topic"]),
  "pay.command": Object.freeze(["system.topic"]),
  "play.command": Object.freeze(["system.topic"]),
  "plug.command": Object.freeze(["network.topic", "system.topic"]),
  "point.command": Object.freeze(["system.topic"]),
  "press.command": Object.freeze(["system.topic"]),
  "print.command": Object.freeze(["system.topic"]),
  "read.command": Object.freeze(["network.topic", "system.topic"]),
  "rename.command": Object.freeze(["system.topic"]),
  "rewrite.command": Object.freeze(["system.topic"]),
  "rip.command": Object.freeze(["system.topic"]),
  "save.command": Object.freeze(["system.topic"]),
  "scan.command": Object.freeze(["network.topic", "system.topic"]),
  "scroll.command": Object.freeze(["network.topic", "system.topic"]),
  "send.command": Object.freeze(["network.topic"]),
  "snap.command": Object.freeze(["system.topic"]),
  "start.command": Object.freeze(["system.topic"]),
  "surf.command": Object.freeze(["network.topic"]),
  "switch.command": Object.freeze(["network.topic", "system.topic"]),
  "touch.command": Object.freeze(["system.topic"]),
  "trash.command": Object.freeze(["system.topic"]),
  "tune.command": Object.freeze(["system.topic"]),
  "turn.command": Object.freeze(["system.topic"]),
  "unlock.command": Object.freeze(["network.topic", "system.topic"]),
  "unzip.command": Object.freeze(["system.topic"]),
  "update.command": Object.freeze(["network.topic", "system.topic"]),
  "upgrade.command": Object.freeze(["network.topic", "system.topic"]),
  "use.command": Object.freeze(["system.topic"]),
  "view.command": Object.freeze(["network.topic", "system.topic"]),
  "watch.command": Object.freeze(["network.topic", "system.topic"]),
  "work.command": Object.freeze(["system.topic"]),
  "write.command": Object.freeze(["system.topic"]),
  "zip.command": Object.freeze(["system.topic"]),
  "zoom.command": Object.freeze(["system.topic"])
});

const reviewedCommandSetIds = Object.keys(REVIEWED_COMMAND_SUBJECTS).sort();
if (
  reviewedCommandSetIds.length !== commandSetIds.length
  || reviewedCommandSetIds.some((setId, index) => setId !== commandSetIds[index])
) {
  throw new Error("every active command requires an explicit reviewed subject relation");
}

export const reviewedCommandTargetRelations = Object.freeze(
  reviewedCommandSetIds.map(commandSetId => Object.freeze({
    commandSetId,
    subjectSetIds: REVIEWED_COMMAND_SUBJECTS[commandSetId]
  }))
);

const relationRecords = [];
for (const { commandSetId, subjectSetIds } of reviewedCommandTargetRelations) {
  for (const subjectSetId of subjectSetIds) {
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
relationRecords.push(Object.freeze({
  id: "edge.quick-modifier.modifies.action",
  from: selector("translationSetId", "quick.modifier"),
  relation: "modifies",
  to: selector("tag", "action"),
  directed: true,
  reviewStatus: "approved"
}));
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
  ...modifierSetIds,
  ...statusSetIds,
  "system.topic",
  "network.topic",
  "forest.topic",
  "retry.command"
].sort());

export const pilotCandidateTranslationSetGroups = Object.freeze([
  Object.freeze({ id: "command", ids: Object.freeze([...commandSetIds].sort()), maxActive: 1 }),
  Object.freeze({ id: "modifier", ids: Object.freeze([...modifierSetIds].sort()), maxActive: 1 }),
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
