# M08 legendary continuation — qualification gate

The five M08 world events require: the matching protagonist, their M06 quest available/active, their M07 clue flag, actual World qualification from M07, and completed M08 World registration.

They set a persistent personal `legendary_m08_qualified_*` flag, without adding any encounter, level, capture, or new map. A player eliminated in M07 cannot activate this checkpoint. The prior clue remains stored, but the legendary quest does not advance.

**Visibility limitation:** This change implements the progression gate only. It does not yet render conditional legendary narration or player choices. The existing story runtime must be checked for supported conditional presentation before authoring visible M08 branches. No unsupported conditional stitches are introduced and the M08 node/choice budget stays unchanged.
