import React, { useState, useMemo } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type TrackCondition = 'all' | 'slick' | 'rubber' | 'wet' | 'tacky';
type CarBehavior = 'select' | 'loose-entry' | 'loose-center' | 'loose-exit'
                 | 'tight-entry' | 'tight-center' | 'tight-exit' | 'need-drive';
type AdjPriority = 'high' | 'medium' | 'low';

interface Adjustment {
  component: string;
  location: string;
  action: string;
  effect: string;
  priority: AdjPriority;
}

interface ConditionGroup {
  id: Exclude<CarBehavior, 'select'>;
  title: string;
  subtitle: string;
  type: 'tighten' | 'loosen' | 'drive';
  baseAdjustments: Adjustment[];
  conditionAdjustments: Partial<Record<Exclude<TrackCondition, 'all'>, Adjustment[]>>;
}

// ─── Tuning Data ─────────────────────────────────────────────────────────────

const BEHAVIOR_DATA: ConditionGroup[] = [

  // ── LOOSE ON ENTRY ──────────────────────────────────────────────────────
  {
    id: 'loose-entry',
    title: 'Car is Loose on Entry',
    subtitle: 'Loose-In / Oversteer at Turn-In',
    type: 'tighten',
    baseAdjustments: [
      { component: 'Shocks', location: 'Left Rear', action: 'Less Rebound (Decrease)', priority: 'high',
        effect: 'Decreasing LR rebound allows the left rear to extend freely during forward weight transfer under braking, keeping the LR tire planted and loaded. Releasing this rebound reduces the "shock tie-down" effect that was pulling the LR off the track and causing the loose snap.' },
      { component: 'Shocks', location: 'Right Front', action: 'More Compression (Increase)', priority: 'high',
        effect: 'Increasing RF compression resists the chassis from rolling rapidly onto the RF tire. This stabilizes the front end on entry and controls the rate at which forward pitch occurs, preventing the rear from getting light before the driver can react.' },
      { component: 'Shocks', location: 'Both Fronts', action: 'More Compression (Increase)', priority: 'high',
        effect: 'Stiffening both front shocks resists rapid forward nose dive under braking. The chassis stays level longer, preserving rear tire loading and preventing the sudden rear-end snap on turn-in that defines a loose-on-entry condition.' },
      { component: 'J-Bar', location: 'Chassis / Frame Mount', action: 'Raise (½" at a time)', priority: 'high',
        effect: 'Raising the frame-side J-bar raises the rear roll center. This reduces body roll and forces more immediate, direct weight transfer to the outside rear tire — stabilizing the rear end before it can rotate on turn-in.' },
      { component: 'Shocks', location: 'Left Rear', action: 'More Compression (Increase)', priority: 'medium',
        effect: 'Stiffening LR compression prevents the left rear chassis corner from collapsing during braking transitions. This preserves the trailing arm design angles and maintains proper rear steer geometry through turn-in.' },
      { component: 'J-Bar', location: 'Pinion / Axle Mount', action: 'Lower (½" at a time)', priority: 'medium',
        effect: 'Lowering the pinion side increases the J-bar rake angle. Under power, this geometry pushes the LR tire harder into the track, adding mechanical downforce that keeps the rear planted.' },
      { component: '4-Link', location: 'RR Lower Rod', action: 'Lower on Chassis', priority: 'medium',
        effect: 'Lowering the right rear bottom bar on the chassis reduces the RR trailing arm angle, limiting entry roll steer so the rear axle tracks squarer and more stable through turn-in.' },
      { component: 'Springs', location: 'Left Front', action: 'Stiffer Rate (+25 lbs)', priority: 'medium',
        effect: 'Stiffening the LF spring holds cross-weight (RF+LR diagonal) longer on turn-in. The car resists rotation, giving the driver more time to control the entry before the rear can step out.' },
      { component: 'Cross-Weight', location: 'RF or LR Perch', action: 'Add (Raise %)', priority: 'medium',
        effect: 'Adding wedge stabilizes the diagonal. Typically ½ to 1 full turn on the RF or LR perch. More cross-weight resists rotation — tightens the car overall. Make small changes and re-evaluate.' },
      { component: 'Tire Spacing', location: 'Left Rear', action: 'Add ½" Wheel Spacer', priority: 'medium',
        effect: 'A LR spacer widens the left-side track, keeping the LR tire flatter and more loaded under braking. This increases LR side bite before the car can rotate on entry.' },
      { component: 'Birdcage', location: 'Right Rear', action: 'Index into RR Spring (2 rounds top & bottom)', priority: 'low',
        effect: 'Indexing 2 rounds into the RR spring pre-loads the birdcage and stiffens the RR corner dynamically. This can tighten a loose entry condition, especially on momentum-type tracks.' },
      { component: 'Wheelbase', location: 'Right Side', action: 'Shorten (¼" increments)', priority: 'low',
        effect: 'Shortening the right side wheelbase slightly pulls the RR tire forward, reducing the trailing arm angle that promotes rotation. Best suited for small, stop-and-go type tracks.' },
    ],
    conditionAdjustments: {
      slick: [
        { component: 'Shocks', location: 'Both Fronts', action: 'Stiffen compression even more vs. tacky', priority: 'high',
          effect: 'On dry-slick, the superior combo is stiffen LF compression AND stiffen LR rebound. This slows violent nose dive and holds the left rear chassis down, keeping rear tires flat and planted to prevent sudden loss of side bite.' },
        { component: 'J-Bar', location: 'Both Ends', action: 'Lower both equally (to center of pinion or below)', priority: 'high',
          effect: 'On dry-slick, lower the J-bar on both ends to lower the rear roll center. This makes the chassis roll slowly and progressively rather than abruptly, preventing the rear from snapping loose on a low-grip surface.' },
        { component: 'Tires', location: 'Left Rear', action: 'Lower Pressure (6–8 PSI)', priority: 'medium',
          effect: 'Slick tracks demand maximum LR contact patch. Lower LR pressure increases footprint width to extract every bit of available mechanical grip.' },
      ],
      rubber: [
        { component: 'Shocks', location: 'Right Front', action: 'More Compression (controlled)', priority: 'medium',
          effect: 'Rubbered grooves reward deliberate entry. Stiffen RF compression slightly to make roll-onto-the-groove more predictable — prevents the front from washing off the narrow rubber lane.' },
      ],
      wet: [
        { component: 'Shocks', location: 'All Corners', action: 'More Compression overall', priority: 'medium',
          effect: 'Wet/heavy tracks require slowing all weight transfer rates. More compression across the board controls the car in soft, unpredictable dirt where grip changes constantly.' },
      ],
      tacky: [
        { component: 'Shocks', location: 'Both Fronts', action: 'Soften compression (vs. slick)', priority: 'medium',
          effect: 'On high-grip tacky tracks, the premier entry-tightening change is to soften front compression, letting the nose dive instantly. The massive available front-end traction pivots the heavy car through turn-in without binding.' },
        { component: 'Shocks', location: 'Right Rear', action: 'Less Compression + Lower RR Lower Link', priority: 'high',
          effect: 'Under high-grip tacky entry conditions, soften RR compression and lower the RR lower link. This lets the RR tire immediately absorb the lateral roll force of turn-in, planting the tire patch into the clay for a stable, planted feel.' },
      ],
    },
  },

  // ── TIGHT ON ENTRY ──────────────────────────────────────────────────────
  {
    id: 'tight-entry',
    title: 'Car is Tight on Entry',
    subtitle: 'Push-In / Understeer at Turn-In',
    type: 'loosen',
    baseAdjustments: [
      { component: 'Shocks', location: 'Left Rear', action: 'More Rebound (Increase)', priority: 'high',
        effect: 'Increasing LR rebound stiffens the "shock tie-down" effect on the left rear. As the chassis rolls right under braking, the stiffer LR rebound pulls weight off the LR corner — this reduces rear traction and intentionally allows the rear to rotate more freely, breaking the push on entry.' },
      { component: 'Shocks', location: 'Right Front', action: 'Less Compression (Decrease)', priority: 'high',
        effect: 'Decreasing RF compression allows the chassis to roll onto the RF tire faster. Rapid RF loading speeds up front-end response, helping the car pivot into the corner rather than pushing straight ahead.' },
      { component: 'Shocks', location: 'Both Fronts', action: 'Less Compression (Decrease)', priority: 'high',
        effect: 'Softening both front shocks allows the nose to dive quickly under braking. Faster forward pitch shifts weight off the rear, reducing rear traction and freeing the car to rotate. On heavy/tacky tracks this is the premier entry-loosening move.' },
      { component: 'J-Bar', location: 'Chassis / Frame Mount', action: 'Lower (½" at a time)', priority: 'high',
        effect: 'Lowering the frame-side J-bar lowers the rear roll center, promoting progressive body roll and allowing the car to turn in more easily. The rear transfers weight more gradually, which frees up rotation on entry.' },
      { component: '4-Link', location: 'RR Bottom Bar', action: 'Steepen (Raise chassis / Lower birdcage)', priority: 'high',
        effect: 'A steeper RR trailing arm angle forces the RR wheel forward dynamically under body roll, inducing "roll steer" to the left (into the corner). This helps the car rotate on entry — exactly what a push-on-entry car needs.' },
      { component: 'Shocks', location: 'Left Rear', action: 'More Compression (Increase)', priority: 'medium',
        effect: 'Stiffening LR compression on a tight-entry car (especially if it is "slamming down") resists the rear-end squat under deceleration. This can help free the front to pivot by keeping the rear geometry stable.' },
      { component: 'J-Bar', location: 'Pinion / Axle Mount', action: 'Raise (½" at a time)', priority: 'medium',
        effect: 'Raising the pinion side flattens the J-bar angle, reducing the vertical downforce component on the LR under deceleration. This makes the rear lighter and easier to rotate on entry.' },
      { component: 'Cross-Weight', location: 'RF or LR Perch', action: 'Remove (Lower %)', priority: 'medium',
        effect: 'Less cross-weight (wedge) allows the car to pivot more freely. Turn the RF or LR perch counter-clockwise ½ to 1 full turn. Removing wedge is one of the most direct ways to loosen a tight-on-entry car.' },
      { component: 'Caster Split', location: 'Front End', action: 'Increase', priority: 'medium',
        effect: 'Adding caster split (more RF caster than LF) increases the dynamic steering angle during body roll. More caster split on the RF helps steer the front end into the corner — can help cure a push on entry.' },
      { component: 'Tire Spacing', location: 'Right Rear', action: 'Add ½" Wheel Spacer', priority: 'medium',
        effect: 'A RR spacer widens the right-side track. This increases roll leverage on entry, letting the right rear step out and rotate — loosening the car at turn-in.' },
      { component: 'Stagger', location: 'Rear Axle', action: 'Add (Increase)', priority: 'medium',
        effect: 'More rear stagger forces natural left-hand rotation under the power. On slick tracks where the car is pushing, adding stagger gives the car the rotation it is currently lacking on entry.' },
      { component: 'Wheelbase', location: 'Right Side', action: 'Lengthen (¼" increments)', priority: 'low',
        effect: 'Lengthening the right side wheelbase pushes the RR tire rearward, adding dynamic roll steer that helps the car rotate on entry. Best for momentum-type tracks.' },
    ],
    conditionAdjustments: {
      slick: [
        { component: 'Shocks', location: 'Both Fronts', action: 'Decrease compression + Soften LR rebound', priority: 'high',
          effect: 'On dry-slick, lower J-bar both ends AND soften LR rebound. Do NOT over-soften front compression as it can make the front wash out. The J-bar and LR rebound combo keeps the rear compliant without sacrificing front stability.' },
        { component: 'Tires', location: 'Right Front', action: 'Lower Pressure (10–12 PSI)', priority: 'medium',
          effect: 'Softer RF carcass increases the steering contact patch on a slick track, giving the front more grip to steer rather than plow.' },
      ],
      rubber: [
        { component: 'Cross-Weight', location: 'RF or LR Perch', action: 'Reduce slightly', priority: 'medium',
          effect: 'In a rubbered groove, the track itself provides rotation assistance. Reduce wedge to let the car pivot through the groove rather than fighting it.' },
      ],
      wet: [
        { component: 'Stagger', location: 'Rear Axle', action: 'Add stagger', priority: 'medium',
          effect: 'Heavy/wet tracks have a wide cushion. More stagger helps the car rotate and use the full track width, preventing a push into the wet clay.' },
      ],
      tacky: [
        { component: 'Springs', location: 'Right Front', action: 'Softer Rate', priority: 'medium',
          effect: 'On tacky track with excellent grip, a softer RF spring allows the front to roll deeper and generate real steering force. This helps cure a push by maximizing RF loading through the full range of body roll.' },
        { component: 'Shocks', location: 'Both Fronts', action: 'Decrease compression (more aggressively)', priority: 'high',
          effect: 'On heavy/tacky, the premier entry-loosening change is soften front compression AND soften the LF spring. The massive available traction lets the nose dive instantly, pivoting the car without binding.' },
      ],
    },
  },

  // ── LOOSE IN CENTER ──────────────────────────────────────────────────────
  {
    id: 'loose-center',
    title: 'Car is Loose in Center',
    subtitle: 'Loose-Middle / Oversteer at Apex',
    type: 'tighten',
    baseAdjustments: [
      { component: 'Shocks', location: 'Right Front', action: 'Less Rebound (Decrease)', priority: 'high',
        effect: 'Decreasing RF rebound allows the nose to rise faster as the driver picks up throttle. The rising nose transfers weight rearward more quickly, loading the rear tires and planting the rear before it can slide. This is the premier mid-corner shock fix from GRT.' },
      { component: 'Shocks', location: 'Left Rear', action: 'Less Compression (Decrease)', priority: 'high',
        effect: 'Decreasing LR compression allows the left rear to compress more freely. This lets the chassis settle smoothly onto the rear tires without the abrupt "bounce" that can cause the rear to step out at the apex.' },
      { component: 'Shocks', location: 'Right Rear', action: 'More Compression (Increase)', priority: 'high',
        effect: 'Increasing RR compression controls the rate at which side bite builds on the RR tire. The controlled weight transfer cushions the rear against snap oversteer at the apex.' },
      { component: 'Springs', location: 'Right Rear', action: 'Softer Rate', priority: 'high',
        effect: 'A softer RR spring allows the chassis to squat heavily onto the RR, crushing the tire tread into the dirt. More carcass deformation equals more side bite — the primary fix for a car sliding in the middle.' },
      { component: 'J-Bar', location: 'Pinion / Axle Mount', action: 'Lower (Increase rake angle)', priority: 'medium',
        effect: 'Lowering the pinion side increases J-bar rake angle, pushing the LR tire harder into the track under cornering loads. More downforce on the LR = more side bite at the apex.' },
      { component: 'J-Bar', location: 'Both Ends', action: 'Lower both equally (lower roll center)', priority: 'medium',
        effect: 'Lowering both ends of the J-bar equally lowers the rear roll center, allowing the chassis to transition slowly and smoothly through the apex — tightening the center and providing more forward traction.' },
      { component: 'Springs', location: 'Right Front', action: 'Stiffer Rate', priority: 'medium',
        effect: 'A stiffer RF spring resists excessive body roll, keeping the front end more stable and inducing a mild understeer push. Mild push through the apex = effectively tightens the center.' },
      { component: '4-Link', location: 'LR Lower Rod', action: 'Lower on Chassis', priority: 'medium',
        effect: 'Lowering the LR lower link on the chassis tightens entry and especially the middle of the corner. This holds the load on the rear-mounted spring longer and promotes less roll steer.' },
      { component: 'Cross-Weight', location: 'RF or LR Perch', action: 'Add slightly (Raise %)', priority: 'medium',
        effect: 'More cross-weight stabilizes the RF+LR diagonal through the apex, preventing the car from pivoting too aggressively mid-corner. Start with ½ turn on the LR perch.' },
      { component: 'Stagger', location: 'Rear Axle', action: 'Reduce (Larry Shaw)', priority: 'medium',
        effect: 'On rubbered tracks, reduce rear stagger. Excessive stagger on high-grip tracks causes too much mid-corner rotation and instability. Reducing stagger aligns both rear wheels for a more stable apex.' },
      { component: 'Tire Spacing', location: 'Right Rear', action: 'Move RR inboard ½"', priority: 'medium',
        effect: 'Moving the right rear wheel inboard loads more weight directly onto the RR tire patch. More RR loading = more side bite = tighter through the apex.' },
      { component: 'Spring Rubber', location: 'Right Front Spring', action: 'Install spring rubber', priority: 'low',
        effect: 'A spring rubber in the RF spring dynamically stiffens the RF corner mid-corner. The car sits flatter through the apex, reducing the pivot tendency that causes mid-corner looseness.' },
    ],
    conditionAdjustments: {
      slick: [
        { component: 'Shocks', location: 'Right Rear', action: 'Soften compression + Stiffen LR compression', priority: 'high',
          effect: 'The ultimate dry-slick mid-corner tightening combo: soften RR compression to maximize the RR tire footprint on the outside tire, while stiffening LR compression keeps the LR chassis from collapsing too quickly, maintaining rear steer geometry.' },
        { component: 'Tires', location: 'Right Rear', action: 'Lower Pressure (10–13 PSI)', priority: 'high',
          effect: 'A dry-slick track offers minimal grip. Lower RR pressure enlarges the side bite contact patch — the only available mechanical grip at the apex on a slick surface.' },
      ],
      rubber: [
        { component: 'Shocks', location: 'Right Rear', action: 'Stiffen RF rebound (instead of decrease)', priority: 'high',
          effect: 'On heavy/tacky tracks, mid-corner looseness usually stems from front tires biting too aggressively. The best move is to stiffen RF rebound. This prevents the nose from lifting under early throttle, keeping front tires steered and cutting a clean arc through the groove.' },
      ],
      wet: [
        { component: 'Shocks', location: 'Right Rear', action: 'More Compression', priority: 'medium',
          effect: 'On a heavy/wet track the car can roll into the cushion abruptly. More RR compression smooths how quickly the rear loads against the heavy dirt, giving the driver a more controlled mid-corner.' },
      ],
      tacky: [
        { component: 'Stagger', location: 'Rear Axle', action: 'Reduce stagger', priority: 'medium',
          effect: 'On a tacky track the surface provides side bite aggressively. Add stagger to the baseline adjustment reduces the mid-corner rotation, helping the car stay stable rather than swapping ends on the high-grip surface.' },
      ],
    },
  },

  // ── TIGHT IN CENTER ──────────────────────────────────────────────────────
  {
    id: 'tight-center',
    title: 'Car is Tight in Center',
    subtitle: 'Tight-Middle / Understeer Through Apex',
    type: 'loosen',
    baseAdjustments: [
      { component: 'Shocks', location: 'Right Front', action: 'More Rebound (Increase)', priority: 'high',
        effect: 'Increasing RF rebound holds the nose of the car down longer through the apex, keeping the chassis from prematurely lifting under throttle. This prevents an early front-end unload that would cause a mid-corner push, and keeps steering pinned through the center.' },
      { component: 'Shocks', location: 'Left Rear', action: 'More Compression (Increase)', priority: 'high',
        effect: 'Increasing LR compression prevents the left rear chassis corner from collapsing during throttle transition. This preserves the trailing arm design height and maintains the rear steer geometry needed to keep the car rotating rather than pushing straight.' },
      { component: 'Shocks', location: 'Left Front', action: 'Less Rebound (Decrease)', priority: 'high',
        effect: 'Decreasing LF rebound allows the left front to extend freely as weight transfers rearward on throttle. This frees up weight transfer off the LF to the rear tires, allowing the rear to generate more traction and reducing the push.' },
      { component: 'Springs', location: 'Right Front', action: 'Softer Rate', priority: 'high',
        effect: 'A softer RF spring allows deep, compliant body roll onto the RF footprint. The RF tire generates maximum steering force when fully loaded — the primary mechanical cure for a center push.' },
      { component: 'Springs', location: 'Right Rear', action: 'Stiffer Rate', priority: 'high',
        effect: 'A stiffer RR spring resists the chassis from rolling too far onto the RR. When the RR "dead-hooks" in side bite, the car stops rotating. A stiffer RR spring keeps the rear loose enough to rotate through the apex.' },
      { component: 'J-Bar', location: 'Both Ends', action: 'Lower both equally (lower roll center)', priority: 'medium',
        effect: 'Lowering both J-bar ends lowers the roll center, allowing the chassis to transition slowly and smoothly through the apex — increasing overall roll and grip, curing a center push.' },
      { component: '4-Link', location: 'LR Upper Rod', action: 'Raise on Chassis', priority: 'medium',
        effect: 'Raising the LR upper link on the chassis loosens the exit slightly and can assist mid-corner rotation when the car is tight through the apex.' },
      { component: '4-Link', location: 'LR Lower Rod', action: 'Raise on Chassis', priority: 'medium',
        effect: 'Raising the left bottom rod on the chassis creates more hike-up and roll steer to the right under throttle, loosening the rear and curing a mid-corner push.' },
      { component: 'Cross-Weight', location: 'RF or LR Perch', action: 'Reduce (Lower %)', priority: 'medium',
        effect: 'Removing wedge allows the car to pivot more freely through the apex. Turn the RF or LR perch counter-clockwise ½ to 1 full turn. This is often the fastest way to loosen a car that is tight in the center.' },
      { component: 'Stagger', location: 'Rear Axle', action: 'Add stagger', priority: 'medium',
        effect: 'Adding rear stagger forces natural left-hand rotation under the power. On a track where the car is tight in the middle, more stagger provides the rotation it is currently lacking.' },
      { component: 'Wheelbase', location: 'Right Side', action: 'Lengthen (¼" increments)', priority: 'low',
        effect: 'Lengthening the right side wheelbase pushes the RR tire rearward, adding dynamic rear steer on the right side that helps the car rotate through the center on momentum-type tracks.' },
    ],
    conditionAdjustments: {
      slick: [
        { component: 'Shocks', location: 'Right Rear', action: 'More Compression', priority: 'high',
          effect: 'To loosen a tight mid-corner in the slick: stiffen RR compression and add rear stagger. Stiffening RR compression prevents the chassis from rolling too heavily over the RR tire sidewall, which collapses the footprint and causes the understeer push.' },
        { component: 'Stagger', location: 'Rear Axle', action: 'Add stagger', priority: 'high',
          effect: 'On dry-slick where the car is pushing in the center, adding stagger gives natural left-turn rotation under the power — the most important fix when grip is low and the car cannot steer mechanically.' },
      ],
      rubber: [
        { component: 'Cross-Weight', location: 'RF or LR Perch', action: 'Reduce', priority: 'medium',
          effect: 'The rubber groove provides side bite aggressively. Reduce wedge to let the car pivot through the groove rather than plowing straight across it.' },
      ],
      wet: [
        { component: 'Stagger', location: 'Rear Axle', action: 'Add stagger', priority: 'medium',
          effect: 'A wide, wet track with lots of cushion benefits from extra stagger to help the car rotate and use the full track width. A pushing car in wet conditions needs rotation more than any other fix.' },
      ],
      tacky: [
        { component: 'Shocks', location: 'Right Front', action: 'Stiffen RF rebound', priority: 'high',
          effect: 'On heavy/tacky, mid-corner push is usually from front tires biting too aggressively. Stiffen RF rebound to prevent the nose from lifting under throttle — keeps front tires steered and cuts a clean arc.' },
        { component: 'Springs', location: 'Right Front', action: 'Softer (more aggressive than slick)', priority: 'medium',
          effect: 'On a tacky track with excellent grip, a softer RF spring allows the front to generate real steering force through the full depth of body roll. Cure a center push by maximizing RF loading.' },
      ],
    },
  },

  // ── LOOSE ON EXIT ──────────────────────────────────────────────────────
  {
    id: 'loose-exit',
    title: 'Car is Loose on Exit',
    subtitle: 'Loose-Out / Oversteer on Throttle',
    type: 'tighten',
    baseAdjustments: [
      { component: 'Shocks', location: 'Left Rear', action: 'Less Compression (Decrease)', priority: 'high',
        effect: 'Decreasing LR compression allows the left rear to squat smoothly and progressively under throttle. This cushions the torque hit, preventing the abrupt "snap" that causes the rear to break traction. Smoother LR squat = more controlled power application.' },
      { component: 'Shocks', location: 'Right Front', action: 'Less Rebound (Decrease)', priority: 'high',
        effect: 'Decreasing RF rebound allows the nose to rise faster under acceleration, transferring weight to the rear drive tires more quickly. Faster rearward weight transfer = more traction = car stays planted off the corner.' },
      { component: 'Shocks', location: 'Right Rear', action: 'More Compression (Increase)', priority: 'high',
        effect: 'Increasing RR compression controls the rate at which side bite builds on the RR tire under acceleration. The controlled cushion absorbs the engine torque hit, preventing the RR from breaking traction on the slippery clay.' },
      { component: 'Pull Bar', location: 'Spring / Bushing', action: 'Softer Spring (or Pliable Bushing)', priority: 'high',
        effect: 'A softer pull bar cushions the initial throttle hit, applying engine torque progressively rather than in a sudden spike. Prevents the rear tires from spinning before the car has forward momentum. If spinning on throttle → soften first.' },
      { component: 'Pull Bar', location: 'Bar Length', action: 'Lengthen Unit', priority: 'high',
        effect: 'A longer pull bar provides a wider leverage arc, smoothing out the torque transition. Makes power application more gentle and progressive — critical on slick tracks.' },
      { component: 'J-Bar', location: 'Pinion / Axle Mount', action: 'Lower (Increase rake angle)', priority: 'high',
        effect: 'Lowering the pinion side steepens the J-bar angle under power, converting lateral cornering forces into vertical downward pressure on the LR. Adds mechanical forward bite and traction on throttle.' },
      { component: '4-Link', location: 'LR Top Bar (Drive Bar)', action: 'Steepen (Raise chassis / Lower birdcage)', priority: 'high',
        effect: 'Steepening the LR "drive bar" angle maximizes dynamic mechanical clamping force on the LR tire footprint under acceleration — maximum forward traction. This is the most direct 4-link fix for a loose-exit car.' },
      { component: 'Pull Bar', location: 'Lateral Position', action: 'Move LEFT on chassis and rearend', priority: 'medium',
        effect: 'Moving the pull bar to the left shifts the torque loading closer to the LR tire, which tightens the corner exit. Moving right loosens exit.' },
      { component: 'Shocks', location: 'Left Rear', action: 'More Rebound (increase)', priority: 'medium',
        effect: 'More LR rebound slows the LR chassis hike-up speed on throttle. Delayed rear steer onset keeps the car planted longer before rear steer begins — extends the drive window.' },
      { component: 'Shocks', location: 'Right Rear', action: 'More Rebound (increase)', priority: 'medium',
        effect: 'More RR rebound resists the RR shock from extending as the car flattens out. This keeps RR side bite pinned longer through the exit phase.' },
      { component: 'Tires', location: 'Left Rear', action: 'Lower Pressure (5–9 PSI)', priority: 'high',
        effect: 'Maximizes LR tire footprint width and length. The LR is the primary source of forward traction — give it the most contact patch possible. If spinning on throttle, this is one of the highest-impact changes.' },
      { component: 'Tire Spacing', location: 'Left Rear', action: 'Add ½" Wheel Spacer', priority: 'medium',
        effect: 'A LR spacer widens the left-side track, keeping the LR tire flatter and more loaded under acceleration — increases forward traction and tightens corner exit.' },
      { component: 'Tire Spacing', location: 'Right Rear', action: 'Move RR inboard ½"', priority: 'medium',
        effect: 'Moving the RR inboard loads more of the car\'s physical weight over the RR tire patch, increasing side bite and tightening the exit.' },
      { component: 'Cross-Weight', location: 'RF or LR Perch', action: 'Add slightly (Raise %)', priority: 'low',
        effect: 'A little more wedge keeps the diagonal (RF+LR) loaded under throttle, which can stabilize a car that is loose on exit.' },
      { component: 'Stagger', location: 'Rear Axle', action: 'Reduce slightly', priority: 'low',
        effect: 'Less rear stagger reduces natural rear steer under power. Less tendency for the rear to swing out on throttle — adds straight-line drive stability.' },
    ],
    conditionAdjustments: {
      slick: [
        { component: 'Pull Bar', location: 'Spring', action: 'Soften further / Use pliable (orange/green) bushing', priority: 'high',
          effect: 'A dry-slick track demands the slowest, most progressive torque delivery possible. Maximum pull bar compliance prevents the slightest tire spin on a surface with virtually no grip.' },
        { component: 'Shocks', location: 'Right Rear', action: 'Double-spring RR combination', priority: 'high',
          effect: 'On dry-slick, run a double spring RR combination (e.g., 10"×100 lb inner + 12"×150 lb barrel outer spring). This provides the same entry roll rate as a single spring but delivers a softer, highly compliant exit rate for ultimate traction.' },
        { component: 'Shocks', location: 'Left Rear (5th coil)', action: 'Decrease LR rebound + Increase gas pressure in LR front/5th coil shock', priority: 'medium',
          effect: 'On dry-slick, decrease LR rebound behind the shock to increase LR bite. Also increase nitrogen gas pressure in the LR front or 5th coil shock to help hold the rear up under deceleration and control axle rotation under power.' },
      ],
      rubber: [
        { component: 'Pull Bar', location: 'Spring', action: 'Can stiffen slightly vs. slick', priority: 'low',
          effect: 'The rubber groove provides significantly more grip. A moderately stiffer pull bar is acceptable in the groove — the track can handle more torque without spinning.' },
      ],
      wet: [
        { component: 'Tires', location: 'Left Rear', action: 'Raise to 8–11 PSI (vs. slick)', priority: 'medium',
          effect: 'On heavy/wet tracks, mud buildup affects handling. Slightly higher pressure than slick settings prevents excessive deformation in soft dirt.' },
      ],
      tacky: [
        { component: 'Shocks', location: 'Right Rear', action: 'Soften RR compression', priority: 'high',
          effect: 'On tacky clay, the superior exit-tightening adjustment is soften RR compression. A soft RR compression shock acts as a cushion, absorbing the engine\'s torque hit and preventing the RR tire from breaking traction on the sticky clay.' },
        { component: 'Pull Bar', location: 'Spring', action: 'Medium stiffness (not as soft as slick)', priority: 'medium',
          effect: 'Tacky grip allows a more assertive throttle application. A medium pull bar spring balances controlled power delivery with the grip the track provides.' },
      ],
    },
  },

  // ── TIGHT ON EXIT ──────────────────────────────────────────────────────
  {
    id: 'tight-exit',
    title: 'Car is Tight on Exit',
    subtitle: 'Tight-Out / Push on Throttle',
    type: 'loosen',
    baseAdjustments: [
      { component: 'Shocks', location: 'Right Front', action: 'More Rebound (Increase)', priority: 'high',
        effect: 'Increasing RF rebound holds the nose of the car down longer under hard acceleration. On slick dirt the nose naturally rises; if it rises too fast the front tires completely unload and the car pushes. More RF rebound holds the chassis posture flat, keeping front tires on the ground for steering while progressively loading the rear.' },
      { component: 'Shocks', location: 'Right Rear', action: 'Less Compression (Decrease)', priority: 'high',
        effect: 'Decreasing RR compression allows the chassis to roll smoothly onto the RR tire, cushioning the tire contact patch and maximizing side bite. When the RR dead-hooks (too much compression resisting the tire), the car can\'t rotate — softening lets it pivot.' },
      { component: 'Shocks', location: 'Left Rear', action: 'More Compression (Increase)', priority: 'high',
        effect: 'Increasing LR compression keeps the left rear chassis from collapsing too quickly under throttle transition, preserving rear steer geometry. This prevents the hike-up from triggering too much roll steer that would push the front.' },
      { component: 'Pull Bar', location: 'Spring / Bushing', action: 'Stiffer Spring (or Harder Bushing)', priority: 'high',
        effect: 'A stiffer pull bar delivers a more immediate and aggressive torque spike on throttle. The rear is hooking too hard — a stiffer pull bar tries to break traction and encourage rotation. If not spinning tires but not driving forward → stiffen.' },
      { component: 'J-Bar', location: 'Pinion / Axle Mount', action: 'Raise (Flatten rake angle)', priority: 'high',
        effect: 'Raising the pinion side flattens the J-bar angle, reducing the mechanical downforce component on the rear end under power. Less downforce = less side bite = car can rotate off the corner rather than pushing.' },
      { component: '4-Link', location: 'LR Bottom Bar', action: 'Steepen (Raise chassis / Lower birdcage)', priority: 'high',
        effect: 'Steepening the LR bottom bar accelerates LR chassis hike-up speed on throttle. Faster hike creates more aggressive rear steer, swinging the rear to the right and rotating the car off the corner.' },
      { component: 'Shocks', location: 'Left Rear', action: 'Less Rebound (Decrease)', priority: 'high',
        effect: 'Less LR rebound allows the LR chassis to snap up instantly on power, triggering immediate rear steer. On a tight-exit car, you want the rear to come around faster — less LR rebound achieves this.' },
      { component: 'Pull Bar', location: 'Lateral Position', action: 'Move RIGHT on chassis and rearend', priority: 'medium',
        effect: 'Moving the pull bar to the right loosens the corner exit by shifting the torque loading away from the LR tire. This reduces the mechanical clamping force that is causing the push.' },
      { component: 'Shocks', location: 'Right Rear', action: 'Less Rebound (Decrease)', priority: 'medium',
        effect: 'Less RR rebound allows the RR shock to extend easily on exit, releasing side bite quickly so the car can square up and rotate off the corner.' },
      { component: 'Tires', location: 'Right Rear', action: 'Higher Pressure (14–16 PSI)', priority: 'medium',
        effect: 'Stiffens the RR tire carcass, preventing it from generating maximum side bite. A stiffer carcass releases the RR earlier in the exit phase, allowing the car to rotate rather than being stuck in the groove.' },
      { component: 'Springs', location: 'Left Rear', action: 'Softer Rate', priority: 'medium',
        effect: 'A softer LR spring promotes deeper chassis hike and suspension separation on throttle. More hike = more rear steer = more rotation to escape the tight-exit push.' },
      { component: 'Stagger', location: 'Rear Axle', action: 'Add slightly', priority: 'medium',
        effect: 'More rear stagger gives natural left-turn rotation under the power — on a tight-exit car this extra rotation is needed to get the car turned and driving down the straight.' },
      { component: 'Caster Split', location: 'Front End', action: 'Reduce (on heavy/tacky)', priority: 'low',
        effect: 'On heavy/tacky tracks, reducing caster split can cure a tight exit by reducing the dynamic steering lock-in on throttle. The front tires don\'t steer as aggressively, allowing the rear to take over.' },
    ],
    conditionAdjustments: {
      slick: [
        { component: 'Shocks', location: 'Right Front', action: 'Stiffen RF rebound + Reduce rear stagger', priority: 'high',
          effect: 'The premier dry-slick tight-exit fix: stiffen RF rebound and reduce rear stagger. RF rebound holds chassis flat so front tires stay on ground while rear progressively loads. Reducing stagger removes natural rear steer that is working against rotation.' },
      ],
      rubber: [
        { component: 'Pull Bar', location: 'Spring', action: 'Stiffen aggressively', priority: 'high',
          effect: 'The rubber groove hooks the rear very hard. A stiff pull bar delivers an aggressive torque spike to break the rear loose and create rotation — necessary when the groove is holding the car in a push.' },
        { component: 'Tires', location: 'Right Rear', action: 'Higher Pressure (14–16 PSI)', priority: 'high',
          effect: 'In rubber, the groove hooks the RR extremely hard. Raise RR pressure to prevent dead-hooking — the stiffer carcass releases side bite earlier and allows rotation.' },
      ],
      wet: [
        { component: 'Stagger', location: 'Rear Axle', action: 'Add stagger', priority: 'medium',
          effect: 'A wet/heavy track with mud in the cushion often pushes on exit. More stagger provides natural rotation to exit the corner properly in heavy conditions.' },
      ],
      tacky: [
        { component: 'Shocks', location: 'Right Front', action: 'Decrease RF rebound (GRT approach)', priority: 'high',
          effect: 'On high-grip tacky/heavy tracks, the most effective exit-loosening move is DECREASE RF rebound. This unloads the front tires immediately under hard acceleration, preventing the aggressive front tires from over-steering into a push, while freeing the rear to rotate.' },
        { component: 'Pull Bar', location: 'Spring', action: 'Stiffer', priority: 'medium',
          effect: 'On tacky track the rear hooks hard. A stiffer pull bar helps rotate the car off the corner by delivering a more aggressive torque spike.' },
      ],
    },
  },

  // ── NEED MORE DRIVE ──────────────────────────────────────────────────────
  {
    id: 'need-drive',
    title: 'Need More Drive Off the Corner',
    subtitle: 'Add Forward Bite / Exit Traction',
    type: 'drive',
    baseAdjustments: [
      { component: 'Pull Bar', location: 'Rate + Location', action: 'Tune rate to conditions; Raise both ends; Move LEFT', priority: 'high',
        effect: 'Tune the pull bar FIRST: spinning tires = soften (orange/green bushing or softer spring). Not spinning but not driving = stiffen (black/blue bushing or stiffer spring). Raise both ends on chassis and rearend to increase anti-squat. Move LEFT to shift torque loading to the LR tire.' },
      { component: 'J-Bar', location: 'Pinion / Axle Mount', action: 'Lower (Increase rake angle)', priority: 'high',
        effect: 'Lowering the pinion side steepens the J-bar angle under power, converting lateral forces into vertical downward pressure on the LR. Maximum mechanical forward traction.' },
      { component: '4-Link', location: 'LR Top Bar (Drive Bar)', action: 'Steepen (Raise chassis / Lower birdcage)', priority: 'high',
        effect: 'Maximum vertical clamping force on the LR tire under acceleration. The LR footprint is compressed firmly into the dirt for maximum forward traction. This is the most direct 4-link tool for forward bite.' },
      { component: 'Tires', location: 'Left Rear', action: 'Lower Pressure (5–9 PSI)', priority: 'high',
        effect: 'The LR is the primary forward traction tire. Lower pressure maximizes footprint area — the most contact patch between rubber and dirt for acceleration.' },
      { component: 'Shocks', location: 'Left Rear', action: 'Less Compression (Decrease)', priority: 'high',
        effect: 'Decreasing LR compression allows the left rear to squat smoothly under acceleration. Smooth, progressive squat = smooth weight transfer = tire stays in contact = more drive. Abrupt LR compression resistance causes the tire to bounce off the track.' },
      { component: 'Shocks', location: 'Right Front', action: 'Less Rebound (Decrease)', priority: 'high',
        effect: 'Decreasing RF rebound allows the nose to lift faster on throttle, transferring weight rearward more quickly. Faster rearward weight transfer = more weight on rear drive tires sooner = more traction.' },
      { component: 'Shocks', location: 'Right Rear', action: 'Soften Compression (Decrease)', priority: 'medium',
        effect: 'Softening RR compression allows weight to transfer rapidly and smoothly to the outside tire. The soft cushion absorbs the power without causing the RR to bounce or break traction.' },
      { component: 'Shocks', location: 'Left Rear', action: 'More Rebound (Increase)', priority: 'medium',
        effect: 'More LR rebound slows the LR chassis hike-up on throttle. Slower hike means the tire stays loaded and driving longer before rear steer begins — more sustained forward bite.' },
      { component: 'Shocks', location: 'LR Front / 5th Coil', action: 'Increase gas pressure', priority: 'medium',
        effect: 'Increasing nitrogen gas pressure in the LR front shock or 5th coil shock helps hold the rear up under deceleration and controls axle housing rotation under power — adds LR bite and forward drive.' },
      { component: '4-Link', location: 'LR Lower Rod', action: 'Lower on chassis (flatten)', priority: 'medium',
        effect: 'Lowering the LR bottom rod on the chassis holds the spring load longer during chassis hike-up under acceleration, maximizing the duration of LR tire loading and sustained forward bite.' },
      { component: 'Tire Spacing', location: 'Left Rear', action: 'Add ½" spacer on LR', priority: 'medium',
        effect: 'Widening the LR footprint increases the tire contact area for acceleration. Simultaneously move the RR inboard ½" to shift physical weight over the RR tire patch.' },
      { component: 'Cross-Weight', location: 'RF or LR Perch', action: 'Add slightly (Raise %)', priority: 'medium',
        effect: 'A little more wedge keeps the RF+LR diagonal loaded under throttle, contributing to a more stable and planted exit.' },
      { component: 'Driver Technique', location: 'Throttle Application', action: 'Roll in throttle — NEVER stab', priority: 'high',
        effect: 'Mechanical changes only work if technique matches. Feed the throttle gradually while simultaneously unwinding the steering. Earlier throttle with patience is faster than waiting and then stabbing the gas.' },
    ],
    conditionAdjustments: {
      slick: [
        { component: 'Tires', location: 'Left Rear', action: '5–7 PSI (minimum safe)', priority: 'high',
          effect: 'A dry-slick track has no grip to spare. Run the LR at the lowest possible safe pressure to extract every ounce of mechanical traction.' },
        { component: 'Springs', location: 'Rear', action: 'Soften both rear springs', priority: 'medium',
          effect: 'Softer rear springs (such as 100 lb or 175 lb RR) allow the suspension to work with the slick surface rather than skipping over it, maintaining consistent tire contact for drive.' },
        { component: 'Driver Technique', location: 'Gas Point', action: 'Wait until fully rotated before throttle', priority: 'high',
          effect: 'On slick, the car must be fully rotated and pointing down the straight BEFORE throttle. Early gas on slick = tire spin = lost momentum. Wait longer than you think.' },
      ],
      rubber: [
        { component: 'Driver Technique', location: 'Groove Line', action: 'Hit the rubber precisely', priority: 'high',
          effect: 'The rubber lane hooks hard — but only if you hit it. Getting off line by even a foot on a rubbered track costs significantly more than any mechanical change.' },
        { component: 'Pull Bar', location: 'Spring', action: 'Can run stiffer vs. slick', priority: 'low',
          effect: 'The rubber groove provides significantly more grip. A moderately stiffer pull bar is acceptable — the track can handle more torque without spinning.' },
      ],
      wet: [
        { component: 'Driver Technique', location: 'Line Choice', action: 'Go wide — use the cushion', priority: 'high',
          effect: 'On wet/heavy, the biggest drive comes from using the cushion. Hit the cushion on exit to slingshot down the straight. This is more valuable than any mechanical change in heavy conditions.' },
        { component: 'Tires', location: 'Left Rear', action: '8–11 PSI', priority: 'medium',
          effect: 'Heavy/wet tracks pack the tire with mud — extremely low pressures cause handling issues. Run slightly higher than slick settings.' },
      ],
      tacky: [
        { component: 'Pull Bar', location: 'Spring', action: 'Medium-stiff spring', priority: 'medium',
          effect: 'Tacky tracks provide real grip. A medium-stiff pull bar lets you apply throttle aggressively and drive hard off the corner.' },
        { component: 'Driver Technique', location: 'Throttle Timing', action: 'Get to throttle EARLIER than slick', priority: 'high',
          effect: 'When the track is tacky, the car can handle earlier throttle application. Rolling on gas sooner in the corner generates more exit momentum and straightaway speed.' },
      ],
    },
  },
];

// ─── Track Condition Descriptions ────────────────────────────────────────────

const TRACK_CONDITION_INFO: Record<Exclude<TrackCondition, 'all'>, { label: string; icon: string; description: string; colorClass: string }> = {
  slick: {
    label: 'Dry & Slick',
    icon: 'wb_sunny',
    description: 'Track has lost moisture. Hard-packed, slippery surface. Minimal grip — tire spin is constant. Focus on smooth power delivery and maximizing footprint. Run shocks on full-soft compression, lower J-bar both ends, soften pull bar.',
    colorClass: 'text-yellow-400',
  },
  rubber: {
    label: 'Rubbered Up',
    icon: 'circle',
    description: 'Dark rubber groove has formed. High grip in a narrow lane — big speed penalty outside it. Reduce rear stagger significantly (excessive stagger causes scrub/drag). Soften rear compression to cushion the groove grip.',
    colorClass: 'text-on-surface-variant',
  },
  wet: {
    label: 'Wet / Heavy',
    icon: 'water_drop',
    description: 'Fresh moisture or rained on. Soft, heavy, wide track. High grip initially — can change rapidly. Wide cushion line is fastest. Increase compression overall. Run grooved tires. Use higher tire pressures vs. slick.',
    colorClass: 'text-blue-400',
  },
  tacky: {
    label: 'Tacky / Cushion',
    icon: 'landscape',
    description: 'Right amount of moisture — sticky, loamy surface. Cushion building on outside. Best conditions. Car should be on edge of loose. Raise J-bar both ends (run 3–4" split). Stiffen RF rebound to hold nose through G-loads.',
    colorClass: 'text-green-400',
  },
};

const CAR_BEHAVIOR_OPTIONS: { value: CarBehavior; label: string; group: string }[] = [
  { value: 'select', label: '— Select what the car is doing —', group: '' },
  { value: 'loose-entry', label: 'Loose on Entry (sliding at turn-in)', group: 'TIGHTEN' },
  { value: 'loose-center', label: 'Loose in Center (sliding at apex)', group: 'TIGHTEN' },
  { value: 'loose-exit', label: 'Loose on Exit (spinning on throttle)', group: 'TIGHTEN' },
  { value: 'tight-entry', label: 'Tight on Entry (pushing at turn-in)', group: 'LOOSEN' },
  { value: 'tight-center', label: 'Tight in Center (pushing through apex)', group: 'LOOSEN' },
  { value: 'tight-exit', label: 'Tight on Exit (pushing on throttle)', group: 'LOOSEN' },
  { value: 'need-drive', label: 'Need More Drive / Forward Bite', group: 'ADD TRACTION' },
];

const TRACK_OPTIONS: { value: TrackCondition; label: string }[] = [
  { value: 'all', label: 'All Conditions' },
  { value: 'slick', label: 'Dry & Slick' },
  { value: 'rubber', label: 'Rubbered Up (Black Groove)' },
  { value: 'wet', label: 'Wet / Heavy / Green Track' },
  { value: 'tacky', label: 'Tacky / Cushion' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function QuickReferenceView() {
  const [carBehavior, setCarBehavior] = useState<CarBehavior>('select');
  const [trackCondition, setTrackCondition] = useState<TrackCondition>('all');
  const [componentFilter, setComponentFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [calcOpen, setCalcOpen] = useState(false);
  const [shockOpen, setShockOpen] = useState(true);
  const [fourLinkOpen, setFourLinkOpen] = useState(true);
  const [jBarOpen, setJBarOpen] = useState(true);
  const [topGear, setTopGear] = useState('');
  const [bottomGear, setBottomGear] = useState('');
  const [driveRatio, setDriveRatio] = useState('4.86');
  const [customDrive, setCustomDrive] = useState('');

  const gearResult = useMemo(() => {
    const top = parseFloat(topGear);
    const bot = parseFloat(bottomGear);
    const drive = driveRatio === 'custom' ? parseFloat(customDrive) : parseFloat(driveRatio);
    if (!isNaN(top) && !isNaN(bot) && bot > 0 && !isNaN(drive) && drive > 0) {
      return (top / bot) * drive;
    }
    return null;
  }, [topGear, bottomGear, driveRatio, customDrive]);

  const activeGroup = useMemo(() => {
    if (carBehavior === 'select') return null;
    return BEHAVIOR_DATA.find(g => g.id === carBehavior) || null;
  }, [carBehavior]);

  const adjustments = useMemo(() => {
    if (!activeGroup) return [];
    const base = [...activeGroup.baseAdjustments];
    const condSpecific = trackCondition !== 'all'
      ? (activeGroup.conditionAdjustments[trackCondition as Exclude<TrackCondition, 'all'>] || [])
      : [];
    const merged = [...base, ...condSpecific];
    const byComponent = componentFilter === 'all'
      ? merged
      : merged.filter(a => a.component === componentFilter);
    const term = searchTerm.toLowerCase().trim();
    const bySearch = term === ''
      ? byComponent
      : byComponent.filter(a =>
          a.component.toLowerCase().includes(term) ||
          a.location.toLowerCase().includes(term) ||
          a.action.toLowerCase().includes(term) ||
          a.effect.toLowerCase().includes(term)
        );
    const order: Record<AdjPriority, number> = { high: 0, medium: 1, low: 2 };
    return bySearch.sort((a, b) => order[a.priority] - order[b.priority]);
  }, [activeGroup, trackCondition, componentFilter, searchTerm]);

  const uniqueComponents = useMemo(() => {
    if (!activeGroup) return [];
    const all = [
      ...activeGroup.baseAdjustments,
      ...Object.values(activeGroup.conditionAdjustments).flat(),
    ];
    return Array.from(new Set(all.map(a => a.component))).sort();
  }, [activeGroup]);

  const highCount = adjustments.filter(a => a.priority === 'high').length;
  const medCount  = adjustments.filter(a => a.priority === 'medium').length;
  const lowCount  = adjustments.filter(a => a.priority === 'low').length;

  const isTighten = activeGroup?.type === 'tighten';
  const isDrive   = activeGroup?.type === 'drive';
  const accentClass = isTighten ? 'text-[#ff5555]' : isDrive ? 'text-tertiary' : 'text-primary';
  const bgAccent    = isTighten ? 'bg-[#ba1a20]/10 border-[#ba1a20]/30' : isDrive ? 'bg-tertiary/10 border-tertiary/30' : 'bg-primary/10 border-primary/30';

  const condInfo = trackCondition !== 'all' ? TRACK_CONDITION_INFO[trackCondition as Exclude<TrackCondition,'all'>] : null;

  return (
    <div className="space-y-4 text-on-surface pb-8" id="quick-reference-page">

      {/* ── MAIN SELECTOR CARD ─────────────────────────────────────────── */}
      <section className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant/60 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">tune</span>
          <div>
            <h2 className="font-display font-bold text-sm uppercase text-on-surface tracking-wide">
              Pit-Side Adjustment Finder
            </h2>
            <p className="text-[10px] font-mono text-on-surface-variant">
              DLM · UMP Modified · IMCA Modified — Oval Dirt Track
            </p>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[10px] font-mono uppercase font-bold text-on-surface-variant mb-1.5 tracking-wider">
              What is the car doing?
            </label>
            <select
              value={carBehavior}
              onChange={e => {
                setCarBehavior(e.target.value as CarBehavior);
                setComponentFilter('all');
                setSearchTerm('');
              }}
              className="w-full bg-background border-2 border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-2.5 rounded outline-none"
            >
              {CAR_BEHAVIOR_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} disabled={opt.value === 'select'}>
                  {opt.group ? `[${opt.group}] ` : ''}{opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase font-bold text-on-surface-variant mb-1.5 tracking-wider">
              Track Condition
            </label>
            <select
              value={trackCondition}
              onChange={e => setTrackCondition(e.target.value as TrackCondition)}
              className="w-full bg-background border-2 border-outline-variant focus:border-primary text-on-surface font-mono text-xs px-3 py-2.5 rounded outline-none"
            >
              {TRACK_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {condInfo && (
            <div className="flex items-start gap-2.5 bg-surface-container-high border border-outline-variant/50 rounded-lg p-3">
              <span className={`material-symbols-outlined text-lg flex-shrink-0 mt-0.5 ${condInfo.colorClass}`}>
                {condInfo.icon}
              </span>
              <div>
                <p className={`font-mono text-[10px] uppercase font-bold tracking-wider ${condInfo.colorClass}`}>
                  {condInfo.label}
                </p>
                <p className="text-[11px] text-on-surface-variant leading-relaxed mt-0.5">
                  {condInfo.description}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── RESULTS ─────────────────────────────────────────────────────── */}
      {carBehavior === 'select' ? (
        <div className="flex items-center gap-2 bg-surface-container border border-outline-variant/50 rounded-lg px-4 py-3">
          <span className="material-symbols-outlined text-primary text-base">manage_search</span>
          <p className="text-[11px] font-mono text-on-surface-variant">
            Select what the car is doing above for a <strong className="text-on-surface">prioritized adjustment list</strong>. Reference guides are always visible below.
          </p>
        </div>
      ) : (
        <>
          <div className={`border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${bgAccent}`}>
            <div>
              <h3 className={`font-display font-black text-sm uppercase tracking-wide ${accentClass}`}>
                {activeGroup?.title}
              </h3>
              <p className="text-[11px] font-mono text-on-surface-variant mt-0.5">
                {activeGroup?.subtitle}
                {trackCondition !== 'all' && (
                  <span className="ml-2 text-primary font-bold">
                    · {TRACK_CONDITION_INFO[trackCondition as Exclude<TrackCondition,'all'>].label}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {highCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-[#ba1a20]/30 border border-[#ba1a20]/50 text-[#ff5555] font-mono text-[9px] font-bold uppercase">
                  {highCount} HIGH
                </span>
              )}
              {medCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-secondary/20 border border-secondary/30 text-secondary font-mono text-[9px] font-bold uppercase">
                  {medCount} MED
                </span>
              )}
              {lowCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-surface-container border border-outline-variant text-on-surface-variant font-mono text-[9px] font-bold uppercase">
                  {lowCount} LOW
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-grow">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-on-surface-variant text-[16px]">search</span>
              <input
                type="text"
                placeholder="Search adjustments..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant focus:border-primary text-xs rounded pl-8 pr-3 py-2 outline-none text-on-surface"
              />
            </div>
            <select
              value={componentFilter}
              onChange={e => setComponentFilter(e.target.value)}
              className="bg-surface-container border border-outline-variant text-[11px] text-on-surface px-2 py-2 rounded outline-none font-mono flex-shrink-0"
            >
              <option value="all">All Parts</option>
              {uniqueComponents.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {adjustments.length === 0 ? (
            <div className="bg-surface-container border border-outline-variant rounded-lg p-8 text-center">
              <span className="material-symbols-outlined text-on-surface-variant/40 text-3xl">search_off</span>
              <p className="font-mono text-xs text-on-surface-variant uppercase font-bold mt-2">No matches</p>
            </div>
          ) : (
            <div className="space-y-2">
              {adjustments.map((adj, i) => {
                const isHigh = adj.priority === 'high';
                const isMed  = adj.priority === 'medium';
                return (
                  <div
                    key={i}
                    className={`bg-surface-container border rounded-lg overflow-hidden ${
                      isHigh ? 'border-[#ba1a20]/40' : isMed ? 'border-secondary/25' : 'border-outline-variant/40'
                    }`}
                  >
                    <div className={`h-0.5 w-full ${isHigh ? 'bg-[#ba1a20]' : isMed ? 'bg-secondary' : 'bg-outline-variant'}`} />
                    <div className="p-3 flex flex-col md:flex-row md:items-start gap-3">
                      <div className="md:w-2/5 flex-shrink-0 space-y-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded ${
                            isHigh ? 'bg-[#ba1a20]/30 text-[#ff5555]' : isMed ? 'bg-secondary/20 text-secondary' : 'bg-surface-container-high text-on-surface-variant'
                          }`}>
                            {adj.priority}
                          </span>
                          <span className="text-[10px] font-mono font-extrabold uppercase text-on-surface bg-surface border border-outline-variant px-2 py-0.5 rounded tracking-wider">
                            {adj.component}
                          </span>
                          <span className="text-[10px] text-on-surface-variant font-mono">{adj.location}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-primary">build</span>
                          <span className={`text-[11px] font-bold font-mono uppercase tracking-wide ${accentClass}`}>
                            {adj.action}
                          </span>
                        </div>
                      </div>
                      <div className="md:w-3/5 text-[11px] text-[#dfdad8] leading-relaxed border-t md:border-t-0 border-outline-variant/30 pt-2 md:pt-0">
                        <span className="text-[9px] text-on-surface-variant font-mono uppercase font-semibold block mb-0.5">Why it works</span>
                        {adj.effect}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Fundamentals */}
          <div className="bg-surface-container-low border border-outline-variant/60 rounded-lg p-4 space-y-2 mt-2">
            <h4 className="font-mono text-[10px] text-on-surface uppercase font-bold tracking-widest flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-primary">info</span>
              Tuning Fundamentals
            </h4>
            <ul className="text-[11px] text-[#bfb9b7] list-disc pl-4 space-y-1 leading-relaxed">
              <li><strong>LOOSE</strong> = rear tires sliding (oversteer). Goal: tighten by planting the rear.</li>
              <li><strong>TIGHT / PUSH</strong> = front plowing, won't steer (understeer). Goal: add rotation.</li>
              <li><strong>Shocks control SPEED</strong> of weight transfer. Springs control the AMOUNT.</li>
              <li><strong>Front Compression</strong> → affects Entry &amp; Middle. <strong>Front Rebound</strong> → Middle &amp; Exit.</li>
              <li><strong>Rear Compression</strong> → Middle &amp; Exit. <strong>Rear Rebound</strong> → Entry &amp; Middle.</li>
              <li><strong>Cross-weight (wedge)</strong>: ½ to 1 turn on RF or LR perch = noticeable change. Always start small.</li>
              <li><strong>Pull bar rate</strong>: spinning tires → soften. Not spinning but not driving → stiffen.</li>
              <li><strong>J-bar frame side</strong> → controls corner entry. <strong>Pinion side</strong> → controls corner exit.</li>
              <li><strong>HIGH priority</strong> first. Make one change, go back on track, evaluate before next change.</li>
              <li><strong>Tuning order</strong>: 1) Corner Entry → 2) Middle → 3) Exit. Always fix entry before middle.</li>
            </ul>
          </div>
        </>
      )}

      {/* ── SHOCK OVERVIEW ────────────────────────────────────────────── */}
      <section className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
        <button
          onClick={() => setShockOpen(v => !v)}
          className="w-full p-4 flex justify-between items-center hover:bg-surface-container-high transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">schema</span>
            <div className="text-left">
              <h3 className="font-display font-bold uppercase text-sm text-on-surface tracking-wide">Shock Adjustment Handling Impacts</h3>
              <p className="text-[10px] font-mono text-on-surface-variant">How each shock change affects handling — entry · middle · exit</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant">{shockOpen ? 'expand_less' : 'expand_more'}</span>
        </button>
        {shockOpen && (
          <div className="border-t border-outline-variant/60 bg-[#0a0a0a] p-4 space-y-4">
            {/* GRT Matrix */}
            <div>
              <p className="text-[10px] font-mono uppercase font-bold text-primary tracking-widest mb-2">Shock Adjustment Matrix — Priority Order by Condition</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] font-mono border-collapse">
                  <thead>
                    <tr className="text-on-surface-variant">
                      <th className="text-left p-1.5 border border-outline-variant/30">Condition</th>
                      <th className="text-left p-1.5 border border-outline-variant/30">#1</th>
                      <th className="text-left p-1.5 border border-outline-variant/30">#2</th>
                      <th className="text-left p-1.5 border border-outline-variant/30">#3</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#dfdad8]">
                    {[
                      ['Loose Entry', 'LR Rebound ↓', 'RF Comp ↑', 'Both Fronts Comp ↑'],
                      ['Tight Entry', 'LR Rebound ↑', 'RF Comp ↓', 'Both Fronts Comp ↓'],
                      ['Loose Mid (On throttle)', 'RF Rebound ↓', 'LR Comp ↓', 'RR Comp ↑'],
                      ['Tight Mid (On throttle)', 'RF Rebound ↑', 'LR Comp ↑', 'LF Rebound ↓'],
                      ['Loose Mid (Off throttle)', 'RR Comp ↓', 'LR Rebound ↓', 'LF Rebound ↓'],
                      ['Tight Mid (Off throttle)', 'RR Comp ↑', 'LR Rebound ↑', 'RF Comp ↓'],
                      ['Loose Exit', 'LR Comp ↓', 'RF Rebound ↓', 'RR Comp ↑'],
                      ['Tight Exit', 'RF Rebound ↑', 'RR Comp ↓', 'LR Comp ↑'],
                    ].map(([cond, a, b, c]) => (
                      <tr key={cond} className="border-b border-outline-variant/20">
                        <td className="p-1.5 border border-outline-variant/30 text-on-surface-variant font-bold">{cond}</td>
                        <td className="p-1.5 border border-outline-variant/30 text-[#ff5555]">{a}</td>
                        <td className="p-1.5 border border-outline-variant/30">{b}</td>
                        <td className="p-1.5 border border-outline-variant/30">{c}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Phase overview grid */}
            <div>
              <p className="text-[10px] font-mono uppercase font-bold text-primary tracking-widest mb-2">Which Phase Each Shock Position Affects</p>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                {[
                  ['Front Compression', 'Entry & Middle'],
                  ['Front Rebound', 'Middle & Exit'],
                  ['Rear Compression', 'Middle & Exit'],
                  ['Rear Rebound', 'Entry & Middle'],
                ].map(([s, e]) => (
                  <div key={s} className="bg-surface-container border border-outline-variant/40 rounded p-2">
                    <p className="text-primary font-bold uppercase text-[9px] tracking-wider">{s}</p>
                    <p className="text-on-surface-variant mt-0.5">Affects: {e}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Corner-by-corner guide */}
            <div>
              <p className="text-[10px] font-mono uppercase font-bold text-primary tracking-widest mb-2">Corner-by-Corner — What Each Shock Does</p>
              <div className="space-y-2 text-[10px] font-mono">
                {[
                  {
                    corner: 'LF — Left Front',
                    comp: { stiffen: 'Slows nose dive on entry → tighter entry, more stable', soften: 'Faster nose dive → looser entry, more rotation at turn-in' },
                    reb: { stiffen: 'Holds LF corner down longer → resists weight leaving LF → tighter middle', soften: 'Allows LF to unload freely on throttle → shifts weight rearward → frees mid-corner push' },
                  },
                  {
                    corner: 'RF — Right Front',
                    comp: { stiffen: 'Resists rapid chassis roll onto RF → stabilizes entry → tighter entry', soften: 'Allows faster roll onto RF → quicker response → loosens entry' },
                    reb: { stiffen: 'Holds nose down under throttle → prevents early front-end lift → tightens middle & exit', soften: 'Allows nose to rise faster → transfers weight to rear quickly → loosens middle & exit' },
                  },
                  {
                    corner: 'LR — Left Rear',
                    comp: { stiffen: 'Resists LR squat on throttle → preserves trailing arm geometry → tightens middle & exit', soften: 'Smooth progressive squat under power → more forward traction → loosens exit, adds drive' },
                    reb: { stiffen: '"Ties down" LR on braking → keeps LR loaded → tightens entry (more rear side bite)', soften: 'LR extends freely under braking → reduces tie-down → loosens entry, rear snaps less' },
                  },
                  {
                    corner: 'RR — Right Rear',
                    comp: { stiffen: 'Controls lateral weight transfer rate to RR → cushions mid/exit loading → tightens middle', soften: 'Allows RR to absorb torque hit smoothly → prevents snap break → loosens exit snap' },
                    reb: { stiffen: 'Holds RR side bite longer → car stays planted in groove → tighter through exit', soften: 'Releases RR side bite faster → car can rotate off corner → loosens exit' },
                  },
                ].map(({ corner, comp, reb }) => (
                  <div key={corner} className="bg-surface-container border border-outline-variant/30 rounded p-2.5">
                    <p className="text-on-surface font-black uppercase text-[10px] tracking-wider mb-1.5">{corner}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <div>
                        <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider mb-0.5">Compression</p>
                        <p className="text-[#ff5555]">↑ Stiffen: {comp.stiffen}</p>
                        <p className="text-primary mt-0.5">↓ Soften: {comp.soften}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider mb-0.5">Rebound</p>
                        <p className="text-[#ff5555]">↑ Stiffen: {reb.stiffen}</p>
                        <p className="text-primary mt-0.5">↓ Soften: {reb.soften}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Shock → Handling Impact Summary */}
            <div>
              <p className="text-[10px] font-mono uppercase font-bold text-primary tracking-widest mb-2">Shock Adjustment → Handling Impact — At a Glance</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] font-mono border-collapse">
                  <thead>
                    <tr className="text-on-surface-variant">
                      <th className="text-left p-1.5 border border-outline-variant/30">Corner</th>
                      <th className="text-left p-1.5 border border-outline-variant/30">Adj.</th>
                      <th className="text-left p-1.5 border border-outline-variant/30 text-[#ff5555]">↑ Stiffen →</th>
                      <th className="text-left p-1.5 border border-outline-variant/30 text-primary">↓ Soften →</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#dfdad8]">
                    {[
                      ['LF', 'Comp', 'Tighter entry — slows nose dive on turn-in', 'Looser entry — faster nose dive, more rotation'],
                      ['LF', 'Reb', 'Tighter middle — holds LF corner loaded through apex', 'Looser middle/exit — frees LF, shifts weight rearward on throttle'],
                      ['RF', 'Comp', 'Tighter entry — resists rapid chassis roll onto RF', 'Looser entry — faster roll onto RF, quicker turn-in response'],
                      ['RF', 'Reb', 'Tighter middle & exit — holds nose down, prevents early lift', 'Looser middle & exit — nose rises faster, weight transfers rearward quickly'],
                      ['LR', 'Comp', 'Tighter middle & exit — preserves trailing arm geometry under throttle', 'Looser exit / more drive — smooth progressive squat, more forward bite'],
                      ['LR', 'Reb', 'Tighter entry — "ties down" LR under braking, rear stays planted', 'Looser entry — LR extends freely, reduces rear snap on turn-in'],
                      ['RR', 'Comp', 'Tighter middle — controls lateral weight transfer rate to RR', 'Loosens exit snap — absorbs torque hit, RR cushions on throttle'],
                      ['RR', 'Reb', 'Tighter exit — holds RR side bite, car stays planted in groove', 'Looser exit — releases RR side bite faster, car can rotate off corner'],
                    ].map(([corner, adj, stiffen, soften]) => (
                      <tr key={`${corner}-${adj}`} className="border-b border-outline-variant/20">
                        <td className="p-1.5 border border-outline-variant/30 text-on-surface font-black">{corner}</td>
                        <td className="p-1.5 border border-outline-variant/30 text-on-surface-variant font-bold">{adj}</td>
                        <td className="p-1.5 border border-outline-variant/30 text-[#ff8888]">{stiffen}</td>
                        <td className="p-1.5 border border-outline-variant/30 text-primary">{soften}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Baseline specs */}
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase font-bold text-primary tracking-widest">Baseline Specs — Modified &amp; Late Model (4-Bar)</p>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono text-on-surface-variant">
                <div className="bg-surface-container border border-outline-variant/30 rounded p-2">
                  <p className="text-on-surface font-bold mb-1 uppercase text-[9px]">Springs (IMCA/UMP)</p>
                  <p>LF: 600 lbs · RF: 650 lbs (UMP)</p>
                  <p>LR: 200 lbs · RR: 175 lbs</p>
                </div>
                <div className="bg-surface-container border border-outline-variant/30 rounded p-2">
                  <p className="text-on-surface font-bold mb-1 uppercase text-[9px]">Ride Heights (IMCA)</p>
                  <p>LF: 8" · RF: 7¾"</p>
                  <p>LR: 11¼" · RR: 10¾"</p>
                </div>
                <div className="bg-surface-container border border-outline-variant/30 rounded p-2">
                  <p className="text-on-surface font-bold mb-1 uppercase text-[9px]">4-Bar Lengths & Angles</p>
                  <p>LR Lower: 14⅛" @ 5-6° up</p>
                  <p>LR Upper: 16⅛" @ 21-23° up</p>
                  <p>RR Lower: 14⅛" @ level</p>
                  <p>RR Upper: 16⅛" @ 17-19° up</p>
                </div>
                <div className="bg-surface-container border border-outline-variant/30 rounded p-2">
                  <p className="text-on-surface font-bold mb-1 uppercase text-[9px]">Weights & Wedge</p>
                  <p>Left Side: 52–53%</p>
                  <p>Rear: 55–56% (Mod) / 53.5–54% (LM)</p>
                  <p>Wedge: 15–25 lbs LR (Mod)</p>
                  <p>Wedge: ~120 lbs LR (Late Model open)</p>
                </div>
                <div className="bg-surface-container border border-outline-variant/30 rounded p-2">
                  <p className="text-on-surface font-bold mb-1 uppercase text-[9px]">J-Bar Split</p>
                  <p>IMCA tires: 3" split</p>
                  <p>UMP/Wissota: 3½"–4" split</p>
                  <p>Late Model: 6½" split</p>
                </div>
                <div className="bg-surface-container border border-outline-variant/30 rounded p-2">
                  <p className="text-on-surface font-bold mb-1 uppercase text-[9px]">Air Pressure (Late Model)</p>
                  <p>LF: 10 · RF: 12</p>
                  <p>LR: 8 · RR: 10 (baseline)</p>
                  <p>Stagger Rear: 4"–5"</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── 4-LINK POSITION REFERENCE ────────────────────────────────── */}
      <section className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
        <button
          onClick={() => setFourLinkOpen(v => !v)}
          className="w-full p-4 flex justify-between items-center hover:bg-surface-container-high transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">linear_scale</span>
            <div className="text-left">
              <h3 className="font-display font-bold uppercase text-sm text-on-surface tracking-wide">4-Link Adjustments</h3>
              <p className="text-[10px] font-mono text-on-surface-variant">All four bars — entry, center &amp; exit handling impacts</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant">{fourLinkOpen ? 'expand_less' : 'expand_more'}</span>
        </button>
        {fourLinkOpen && (
          <div className="border-t border-outline-variant/60 bg-[#0a0a0a] p-4 space-y-4 text-[11px] font-mono">

            {/* Quick-read angle key */}
            <div className="flex gap-3 text-[10px]">
              <span className="px-2 py-0.5 rounded bg-[#ba1a20]/20 border border-[#ba1a20]/40 text-[#ff5555] font-bold">Steeper ↑</span>
              <span className="text-on-surface-variant">=</span>
              <span className="text-on-surface-variant">Raise chassis-side mount OR lower birdcage/axle-side mount</span>
            </div>
            <div className="flex gap-3 text-[10px]">
              <span className="px-2 py-0.5 rounded bg-primary/20 border border-primary/40 text-primary font-bold">Flatter ↓</span>
              <span className="text-on-surface-variant">=</span>
              <span className="text-on-surface-variant">Lower chassis-side mount OR raise birdcage/axle-side mount</span>
            </div>

            {/* LR Lower Bar */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase font-bold text-primary tracking-widest">LR Lower Bar (Controls Hike-Up Speed &amp; Rear Steer)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div className="bg-surface-container border border-[#ba1a20]/30 rounded p-2.5 space-y-1">
                  <p className="text-[#ff5555] font-bold text-[10px] uppercase">Steeper Angle (raise chassis / lower birdcage)</p>
                  <ul className="text-on-surface-variant space-y-0.5 list-disc pl-3 text-[10px] leading-relaxed">
                    <li>Faster LR chassis hike-up under acceleration</li>
                    <li>More aggressive rear steer → loosens exit, promotes rotation</li>
                    <li>Tightens corner entry (less low-speed roll steer)</li>
                  </ul>
                </div>
                <div className="bg-surface-container border border-primary/30 rounded p-2.5 space-y-1">
                  <p className="text-primary font-bold text-[10px] uppercase">Flatter Angle (lower chassis / raise birdcage)</p>
                  <ul className="text-on-surface-variant space-y-0.5 list-disc pl-3 text-[10px] leading-relaxed">
                    <li>Slower hike-up, more progressive rear steer</li>
                    <li>Tightens exit, holds car straight longer under throttle</li>
                    <li>Tightens middle — holds spring load longer during hike</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* LR Upper Bar (Drive Bar) */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase font-bold text-primary tracking-widest">LR Upper Bar / Drive Bar (Controls Anti-Squat &amp; Forward Bite)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div className="bg-surface-container border border-[#ba1a20]/30 rounded p-2.5 space-y-1">
                  <p className="text-[#ff5555] font-bold text-[10px] uppercase">Steeper Angle (raise chassis / lower birdcage)</p>
                  <ul className="text-on-surface-variant space-y-0.5 list-disc pl-3 text-[10px] leading-relaxed">
                    <li>Maximum anti-squat — LR tire mechanically clamped into track</li>
                    <li>Maximum forward bite under acceleration</li>
                    <li>Primary 4-link tool for loose-exit or need-more-drive</li>
                  </ul>
                </div>
                <div className="bg-surface-container border border-primary/30 rounded p-2.5 space-y-1">
                  <p className="text-primary font-bold text-[10px] uppercase">Flatter Angle (lower chassis / raise birdcage)</p>
                  <ul className="text-on-surface-variant space-y-0.5 list-disc pl-3 text-[10px] leading-relaxed">
                    <li>Less anti-squat, softer power delivery</li>
                    <li>Reduces forward bite — use if rear is hooking too hard</li>
                    <li>More rotation available off the corner</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* RR Lower Bar */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase font-bold text-primary tracking-widest">RR Lower Bar (Controls Entry Roll Steer)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div className="bg-surface-container border border-[#ba1a20]/30 rounded p-2.5 space-y-1">
                  <p className="text-[#ff5555] font-bold text-[10px] uppercase">Steeper Angle</p>
                  <ul className="text-on-surface-variant space-y-0.5 list-disc pl-3 text-[10px] leading-relaxed">
                    <li>More RR roll steer on corner entry → forces RR wheel forward</li>
                    <li>Promotes rotation — loosens entry</li>
                    <li>Helps cure tight-on-entry push</li>
                  </ul>
                </div>
                <div className="bg-surface-container border border-primary/30 rounded p-2.5 space-y-1">
                  <p className="text-primary font-bold text-[10px] uppercase">Flatter Angle (lower on chassis)</p>
                  <ul className="text-on-surface-variant space-y-0.5 list-disc pl-3 text-[10px] leading-relaxed">
                    <li>Less roll steer — rear axle tracks squarer</li>
                    <li>More stable, tighter entry</li>
                    <li>Helps cure loose-on-entry snap</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* RR Upper Bar */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase font-bold text-primary tracking-widest">RR Upper Bar (RR Anti-Squat &amp; Side Bite)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div className="bg-surface-container border border-[#ba1a20]/30 rounded p-2.5 space-y-1">
                  <p className="text-[#ff5555] font-bold text-[10px] uppercase">Steeper Angle</p>
                  <ul className="text-on-surface-variant space-y-0.5 list-disc pl-3 text-[10px] leading-relaxed">
                    <li>More RR anti-squat — loads RR tire harder under power</li>
                    <li>Increases RR side bite, tightens exit</li>
                  </ul>
                </div>
                <div className="bg-surface-container border border-primary/30 rounded p-2.5 space-y-1">
                  <p className="text-primary font-bold text-[10px] uppercase">Flatter Angle</p>
                  <ul className="text-on-surface-variant space-y-0.5 list-disc pl-3 text-[10px] leading-relaxed">
                    <li>Less RR loading — allows RR to release and rotate</li>
                    <li>Loosens exit, reduces dead-hook tendency</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 4-Link Handling Scenario Quick Guide */}
            <div>
              <p className="text-[10px] font-mono uppercase font-bold text-primary tracking-widest mb-2">4-Link Handling Scenario Quick Guide</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] font-mono border-collapse">
                  <thead>
                    <tr className="text-on-surface-variant">
                      <th className="text-left p-1.5 border border-outline-variant/30">Car Behavior</th>
                      <th className="text-left p-1.5 border border-outline-variant/30">Bar</th>
                      <th className="text-left p-1.5 border border-outline-variant/30">Adjustment</th>
                      <th className="text-left p-1.5 border border-outline-variant/30">Handling Result</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#dfdad8]">
                    {[
                      ['Loose Entry', 'RR Lower', 'Flatter — lower on chassis', 'Less roll steer → rear axle tracks squarer, more stable on turn-in'],
                      ['Tight Entry', 'RR Lower', 'Steeper — raise chassis', 'More roll steer → forces RR wheel forward, promotes rotation at turn-in'],
                      ['Loose Center', 'LR Lower', 'Flatter — lower on chassis', 'Holds spring load longer → less roll steer, tightens the middle'],
                      ['Tight Center', 'LR Lower', 'Steeper — raise chassis / lower birdcage', 'More roll steer under throttle → loosens middle, adds rotation through apex'],
                      ['Tight Center', 'LR Upper', 'Raise on chassis', 'Increases anti-squat angle → assists mid-corner rotation when apex is tight'],
                      ['Loose Exit', 'LR Upper', 'Steeper — raise chassis / lower birdcage', 'Max anti-squat → LR tire clamped to track = max forward bite, tightens exit'],
                      ['Tight Exit', 'LR Lower', 'Steeper — raise chassis / lower birdcage', 'Faster hike-up speed → more aggressive rear steer → loosens exit rotation'],
                      ['Need Drive', 'LR Upper', 'Steepen to maximum safe angle', 'Maximum vertical clamping force on LR footprint under acceleration'],
                      ['Need Drive', 'LR Lower', 'Flatten — lower on chassis', 'Holds spring load longer during hike-up → sustained forward bite off corner'],
                    ].map(([behavior, bar, adj, result], i) => (
                      <tr key={i} className="border-b border-outline-variant/20">
                        <td className="p-1.5 border border-outline-variant/30 text-on-surface-variant font-bold">{behavior}</td>
                        <td className="p-1.5 border border-outline-variant/30 text-on-surface font-bold">{bar}</td>
                        <td className="p-1.5 border border-outline-variant/30">{adj}</td>
                        <td className="p-1.5 border border-outline-variant/30 text-primary">{result}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Baseline reference angles */}
            <div className="bg-surface-container border border-outline-variant/40 rounded p-3 space-y-1.5">
              <p className="text-[10px] uppercase font-bold text-on-surface tracking-wider">Baseline Bar Lengths &amp; Angles</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-on-surface-variant">
                <div><p className="text-on-surface font-bold">LR Lower</p><p>14⅛" @ 5–6° up</p></div>
                <div><p className="text-on-surface font-bold">LR Upper</p><p>16⅛" @ 21–23° up</p></div>
                <div><p className="text-on-surface font-bold">RR Lower</p><p>14⅛" @ level</p></div>
                <div><p className="text-on-surface font-bold">RR Upper</p><p>16⅛" @ 17–19° up</p></div>
              </div>
            </div>

          </div>
        )}
      </section>

      {/* ── J-BAR REFERENCE ───────────────────────────────────────────── */}
      <section className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
        <button
          onClick={() => setJBarOpen(v => !v)}
          className="w-full p-4 flex justify-between items-center hover:bg-surface-container-high transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">straighten</span>
            <div className="text-left">
              <h3 className="font-display font-bold uppercase text-sm text-on-surface tracking-wide">J-Bar / Panhard Bar Reference</h3>
              <p className="text-[10px] font-mono text-on-surface-variant">Frame side (entry) · Pinion side (exit) · Height &amp; rake effects</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant">{jBarOpen ? 'expand_less' : 'expand_more'}</span>
        </button>
        {jBarOpen && (
          <div className="border-t border-outline-variant/60 bg-[#0a0a0a] p-4 space-y-4 text-[11px] font-mono">

            {/* Frame / Chassis Side */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase font-bold text-primary tracking-widest">Frame / Chassis Side — Controls Corner Entry</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div className="bg-surface-container border border-[#ba1a20]/30 rounded p-2.5 space-y-1">
                  <p className="text-[#ff5555] font-bold text-[10px] uppercase">Raise Frame Mount</p>
                  <ul className="text-on-surface-variant space-y-0.5 list-disc pl-3 text-[10px] leading-relaxed">
                    <li>Raises rear roll center</li>
                    <li>Faster, more direct lateral weight transfer on entry</li>
                    <li>Reduces body roll — rear plants more immediately</li>
                    <li><strong className="text-on-surface">Tightens corner entry</strong> — use for loose-on-entry</li>
                  </ul>
                </div>
                <div className="bg-surface-container border border-primary/30 rounded p-2.5 space-y-1">
                  <p className="text-primary font-bold text-[10px] uppercase">Lower Frame Mount</p>
                  <ul className="text-on-surface-variant space-y-0.5 list-disc pl-3 text-[10px] leading-relaxed">
                    <li>Lowers rear roll center</li>
                    <li>Slower, more progressive weight transfer on entry</li>
                    <li>More body roll — rear steps out more easily</li>
                    <li><strong className="text-on-surface">Loosens corner entry</strong> — use for tight-on-entry</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Pinion / Axle Side */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase font-bold text-primary tracking-widest">Pinion / Axle Side — Controls Corner Exit &amp; Forward Bite</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div className="bg-surface-container border border-[#ba1a20]/30 rounded p-2.5 space-y-1">
                  <p className="text-[#ff5555] font-bold text-[10px] uppercase">Lower Pinion Mount (Steepen Rake)</p>
                  <ul className="text-on-surface-variant space-y-0.5 list-disc pl-3 text-[10px] leading-relaxed">
                    <li>Steeper J-bar rake angle under power</li>
                    <li>Converts lateral forces into vertical downforce on LR</li>
                    <li>Adds mechanical forward bite</li>
                    <li><strong className="text-on-surface">Tightens exit &amp; adds drive</strong></li>
                    <li>Also increases LR side bite at mid-corner</li>
                  </ul>
                </div>
                <div className="bg-surface-container border border-primary/30 rounded p-2.5 space-y-1">
                  <p className="text-primary font-bold text-[10px] uppercase">Raise Pinion Mount (Flatten Rake)</p>
                  <ul className="text-on-surface-variant space-y-0.5 list-disc pl-3 text-[10px] leading-relaxed">
                    <li>Flatter rake — less mechanical downforce under power</li>
                    <li>Rear end lighter under acceleration</li>
                    <li>Easier to rotate off the corner</li>
                    <li><strong className="text-on-surface">Loosens exit</strong> — use for tight-on-exit push</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Overall Height — Both Ends */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase font-bold text-primary tracking-widest">Overall Height — Moving Both Ends Equally</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div className="bg-surface-container border border-[#ba1a20]/30 rounded p-2.5 space-y-1">
                  <p className="text-[#ff5555] font-bold text-[10px] uppercase">Raise Both Ends</p>
                  <ul className="text-on-surface-variant space-y-0.5 list-disc pl-3 text-[10px] leading-relaxed">
                    <li>Higher overall roll center</li>
                    <li>Quicker, more abrupt weight transfer</li>
                    <li>More stable, more planted — suited for tacky/high-grip</li>
                    <li>Run 3–4" split on tacky conditions</li>
                  </ul>
                </div>
                <div className="bg-surface-container border border-primary/30 rounded p-2.5 space-y-1">
                  <p className="text-primary font-bold text-[10px] uppercase">Lower Both Ends</p>
                  <ul className="text-on-surface-variant space-y-0.5 list-disc pl-3 text-[10px] leading-relaxed">
                    <li>Lower roll center — slower, more progressive transitions</li>
                    <li>More chassis roll and rotation overall</li>
                    <li>Tightens mid-corner as car transitions more smoothly</li>
                    <li>Preferred on dry-slick, prevents abrupt snap</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Height Split Reference */}
            <div className="bg-surface-container border border-outline-variant/40 rounded p-3 space-y-2">
              <p className="text-[10px] uppercase font-bold text-on-surface tracking-wider">J-Bar Height Split (Frame Height − Pinion Height)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-on-surface-variant">
                <div><p className="text-on-surface font-bold">IMCA Tires</p><p>3" split (baseline)</p></div>
                <div><p className="text-on-surface font-bold">UMP / Wissota</p><p>3½"–4" split</p></div>
                <div><p className="text-on-surface font-bold">Late Model</p><p>6½" split · 1" below pinion</p></div>
              </div>
              <p className="text-on-surface-variant text-[10px] leading-relaxed border-t border-outline-variant/30 pt-2">
                <strong className="text-on-surface">More split</strong> = higher roll center on frame side = more directional stability = better on high-grip. &nbsp;
                <strong className="text-on-surface">Less split</strong> = lower, flatter bar = more rotation = better on slick.
              </p>
            </div>

          </div>
        )}
      </section>

      {/* ── GEAR RATIO CALCULATOR ─────────────────────────────────────── */}
      <section className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
        <button
          onClick={() => setCalcOpen(v => !v)}
          className="w-full p-4 flex justify-between items-center hover:bg-surface-container-high transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">calculate</span>
            <div className="text-left">
              <h3 className="font-display font-bold uppercase text-sm text-on-surface tracking-wide">Gear Ratio Calculator</h3>
              <p className="text-[10px] font-mono text-on-surface-variant">(Top Gear ÷ Bottom Gear) × Drive Ratio</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant">{calcOpen ? 'expand_less' : 'expand_more'}</span>
        </button>
        {calcOpen && (
          <div className="p-4 border-t border-outline-variant/60 bg-[#0a0a0a] space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[9px] font-mono uppercase text-on-surface-variant mb-1 font-bold tracking-wider">Top Gear</label>
                <input type="number" step="1" min="1" value={topGear} onChange={e => setTopGear(e.target.value)} placeholder="e.g. 22"
                  className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-3 py-2 outline-none rounded" />
              </div>
              <div>
                <label className="block text-[9px] font-mono uppercase text-on-surface-variant mb-1 font-bold tracking-wider">Bottom Gear</label>
                <input type="number" step="1" min="1" value={bottomGear} onChange={e => setBottomGear(e.target.value)} placeholder="e.g. 10"
                  className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-3 py-2 outline-none rounded" />
              </div>
              <div>
                <label className="block text-[9px] font-mono uppercase text-on-surface-variant mb-1 font-bold tracking-wider">Drive Ratio</label>
                <select value={driveRatio} onChange={e => setDriveRatio(e.target.value)}
                  className="w-full bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-3 py-2 outline-none rounded">
                  <option value="4.86">4.86 (Default)</option>
                  <option value="4.11">4.11</option>
                  <option value="5.14">5.14</option>
                  <option value="custom">Custom…</option>
                </select>
                {driveRatio === 'custom' && (
                  <input type="number" step="0.01" min="1" value={customDrive} onChange={e => setCustomDrive(e.target.value)} placeholder="e.g. 5.14"
                    className="w-full mt-1.5 bg-surface border border-outline-variant focus:border-primary text-on-surface font-mono text-sm px-3 py-2 outline-none rounded" />
                )}
              </div>
            </div>
            {gearResult !== null ? (
              <div className="bg-surface-container border border-primary/30 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase text-on-surface-variant font-bold">Calculated Gear Ratio</p>
                  <p className="text-[11px] font-mono text-on-surface-variant/70 mt-0.5">
                    ({topGear} ÷ {bottomGear}) × {driveRatio === 'custom' ? (customDrive || '?') : driveRatio}
                  </p>
                </div>
                <span className="font-mono text-4xl font-black text-primary tracking-tight">{gearResult.toFixed(3)}</span>
              </div>
            ) : (
              <div className="bg-surface-container border border-outline-variant/40 rounded-lg p-4 text-center">
                <p className="font-mono text-xs text-on-surface-variant/50">Enter Top Gear and Bottom Gear values to calculate</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
