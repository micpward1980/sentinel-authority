// ============================================================================
// SENTINEL AUTHORITY — 121 ODDC System Types with Boundary Templates
// Generated for ENVELO ODDC Platform
// ============================================================================
//
// Each system type includes:
//   - domain group (for <optgroup> rendering)
//   - full boundary template: numeric, geo, time, state, ODD description, safety
//
// Usage: import { SYSTEM_TYPES, DOMAIN_GROUPS } from './systemTypesData';
//        Then use applyTemplate(systemTypeKey) to auto-fill the wizard.
// ============================================================================

export const DOMAIN_GROUPS = [
  { key: 'ground_robots', label: 'Ground Robots & Mobile Platforms' },
  { key: 'aerial', label: 'Aerial Systems (UAV / UAS)' },
  { key: 'vehicles', label: 'Autonomous Vehicles & Mobility' },
  { key: 'marine', label: 'Marine & Maritime' },
  { key: 'medical', label: 'Medical & Healthcare' },
  { key: 'financial', label: 'Financial & Trading' },
  { key: 'energy', label: 'Energy & Utilities' },
  { key: 'manufacturing', label: 'Manufacturing & Industrial' },
  { key: 'defense', label: 'Defense & Security' },
  { key: 'agriculture', label: 'Agriculture & Environment' },
  { key: 'space_extreme', label: 'Space & Extreme Environments' },
  { key: 'telecom_digital', label: 'Telecommunications & Digital Infrastructure' },
  { key: 'construction', label: 'Construction & Mining' },
  { key: 'logistics', label: 'Logistics & Supply Chain' },
  { key: 'retail_hospitality', label: 'Retail & Hospitality' },
  { key: 'education_research', label: 'Education & Research' },
  { key: 'legal_compliance', label: 'Legal & Compliance' },
  { key: 'other', label: 'Other / Custom' },
];

export const SYSTEM_TYPES = {

  // ══════════════════════════════════════════════════════════════════════════
  // GROUND ROBOTS & MOBILE PLATFORMS
  // ══════════════════════════════════════════════════════════════════════════

  warehouse_amr_indoor: {
    label: 'Warehouse AMR (Indoor)',
    domain: 'ground_robots',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 2.0, unit: 'm/s', tolerance: 0.1 },
        { name: 'max_payload', min: 0, max: 500, unit: 'kg', tolerance: 5 },
        { name: 'max_shelf_height', min: 0, max: 8, unit: 'm', tolerance: 0.1 },
        { name: 'min_obstacle_clearance', min: 0.3, max: null, unit: 'm', tolerance: 0.05 },
      ],
      geo: { type: 'polygon', description: 'Warehouse floor plan boundary — excludes human-only zones, charging stations, loading docks during active operations' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['idle','navigating','picking','placing','charging','queued'], forbidden: ['manual_override_disabled','sensor_degraded_navigation'] },
      odd_description: 'Indoor warehouse environment with controlled lighting, flat concrete floors, marked aisles, and mixed human-robot zones. System operates within geofenced warehouse boundary with speed reduction in human-occupied zones.',
      safety: { violation_action: 'block', fail_closed: true, human_zone_speed_limit: 0.5, emergency_stop: true },
    },
  },

  warehouse_amr_cold_storage: {
    label: 'Warehouse AMR (Cold Storage)',
    domain: 'ground_robots',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 1.5, unit: 'm/s', tolerance: 0.1 },
        { name: 'max_payload', min: 0, max: 400, unit: 'kg', tolerance: 5 },
        { name: 'min_operating_temp', min: -30, max: 5, unit: '°C', tolerance: 1 },
        { name: 'max_continuous_cold_exposure', min: 0, max: 120, unit: 'min', tolerance: 5 },
      ],
      geo: { type: 'polygon', description: 'Cold storage facility boundary — includes freezer zones, transition airlocks, excludes warm staging areas' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['idle','navigating','picking','placing','charging','defrost_cycle'], forbidden: ['battery_below_20pct_in_freezer','condensation_detected'] },
      odd_description: 'Cold storage warehouse (-25°C to 5°C) with frost-resistant flooring, limited visibility, and mandatory defrost cycling. Robot must return to warm zone before battery threshold.',
      safety: { violation_action: 'block', fail_closed: true, emergency_stop: true },
    },
  },

  last_mile_delivery_robot: {
    label: 'Last-Mile Delivery Robot',
    domain: 'ground_robots',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 6, unit: 'km/h', tolerance: 0.5 },
        { name: 'max_payload', min: 0, max: 25, unit: 'kg', tolerance: 1 },
        { name: 'max_range', min: 0, max: 30, unit: 'km', tolerance: 1 },
        { name: 'min_battery_for_return', min: 20, max: null, unit: '%', tolerance: 2 },
      ],
      geo: { type: 'polygon', description: 'Approved sidewalk corridors and pedestrian zones — excludes roadways, private property beyond delivery points, restricted government areas' },
      time: { operating_hours: '06:00-22:00', operating_days: [0,1,2,3,4,5,6], timezone: 'delivery_zone_local' },
      states: { allowed: ['idle','en_route','delivering','returning','charging','waiting_pickup'], forbidden: ['road_surface_detected','pedestrian_density_exceeded'] },
      odd_description: 'Urban/suburban sidewalk environment during daylight and early evening. System navigates pedestrian infrastructure only, yields to all pedestrians, and maintains minimum battery reserve for return to base.',
      safety: { violation_action: 'block', fail_closed: true, max_pedestrian_proximity: 0.5, emergency_stop: true },
    },
  },

  sidewalk_delivery_robot: {
    label: 'Sidewalk Delivery Robot (Campus)',
    domain: 'ground_robots',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 4, unit: 'km/h', tolerance: 0.5 },
        { name: 'max_payload', min: 0, max: 10, unit: 'kg', tolerance: 0.5 },
        { name: 'max_incline', min: 0, max: 15, unit: 'degrees', tolerance: 1 },
      ],
      geo: { type: 'polygon', description: 'Campus pedestrian pathways — excludes vehicle roads, building interiors, construction zones' },
      time: { operating_hours: '07:00-23:00', operating_days: [0,1,2,3,4,5,6], timezone: 'campus_local' },
      states: { allowed: ['idle','navigating','delivering','waiting','charging'], forbidden: ['road_detected','stairway_detected'] },
      odd_description: 'University or corporate campus pedestrian pathways. Flat to moderate grade, paved surfaces, mixed foot traffic. System operates during campus active hours only.',
      safety: { violation_action: 'block', fail_closed: true, emergency_stop: true },
    },
  },

  campus_shuttle_low_speed: {
    label: 'Campus Shuttle (Low-Speed AV)',
    domain: 'ground_robots',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 25, unit: 'km/h', tolerance: 1 },
        { name: 'max_passengers', min: 0, max: 12, unit: 'persons', tolerance: 0 },
        { name: 'max_grade', min: 0, max: 10, unit: '%', tolerance: 0.5 },
        { name: 'min_visibility', min: 50, max: null, unit: 'm', tolerance: 5 },
      ],
      geo: { type: 'polygon', description: 'Fixed campus route with approved stops — excludes public roadways, parking structures, pedestrian-only zones' },
      time: { operating_hours: '06:00-22:00', operating_days: [1,2,3,4,5], timezone: 'facility_local' },
      states: { allowed: ['idle','en_route','stopped_at_station','loading','unloading','returning_to_depot'], forbidden: ['off_route','door_open_while_moving','passenger_standing'] },
      odd_description: 'Fixed-route low-speed shuttle on private campus roads. Controlled environment with designated stops, speed bumps, and pedestrian crossings. No public road interaction.',
      safety: { violation_action: 'block', fail_closed: true, door_interlock: true, emergency_stop: true },
    },
  },

  security_patrol_robot: {
    label: 'Security Patrol Robot',
    domain: 'ground_robots',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 5, unit: 'km/h', tolerance: 0.5 },
        { name: 'max_patrol_radius', min: 0, max: 2000, unit: 'm', tolerance: 10 },
        { name: 'min_battery_reserve', min: 15, max: null, unit: '%', tolerance: 2 },
      ],
      geo: { type: 'polygon', description: 'Facility perimeter and approved patrol corridors — excludes public areas, sensitive restricted zones without clearance' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['patrolling','stationary_monitoring','returning_to_base','charging','alert_mode'], forbidden: ['pursuit_mode','physical_intervention'] },
      odd_description: 'Outdoor facility perimeter and indoor corridors. System performs observation and alerting only — no physical intervention capability. Operates in all weather within sensor limits.',
      safety: { violation_action: 'block', fail_closed: true, no_pursuit: true, emergency_stop: true },
    },
  },

  agricultural_field_robot: {
    label: 'Agricultural Field Robot',
    domain: 'ground_robots',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 10, unit: 'km/h', tolerance: 0.5 },
        { name: 'max_spray_rate', min: 0, max: 200, unit: 'L/ha', tolerance: 5 },
        { name: 'max_wind_speed', min: 0, max: 15, unit: 'km/h', tolerance: 1 },
        { name: 'buffer_zone_waterway', min: 10, max: null, unit: 'm', tolerance: 1 },
      ],
      geo: { type: 'polygon', description: 'Defined field boundaries — excludes waterways, buffer zones, neighboring properties, public roads' },
      time: { operating_hours: '05:00-21:00', operating_days: [0,1,2,3,4,5,6], timezone: 'farm_local' },
      states: { allowed: ['idle','seeding','spraying','harvesting','transiting','charging'], forbidden: ['wind_exceeded','rain_during_spray','near_waterway_while_spraying'] },
      odd_description: 'Open agricultural field with GPS-defined boundaries. System operates on soil/crop surfaces in fair weather. Spray operations prohibited near waterways and above wind thresholds.',
      safety: { violation_action: 'block', fail_closed: true, spray_shutoff: true, emergency_stop: true },
    },
  },

  vineyard_orchard_robot: {
    label: 'Vineyard / Orchard Robot',
    domain: 'ground_robots',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 5, unit: 'km/h', tolerance: 0.5 },
        { name: 'max_arm_reach', min: 0, max: 2.5, unit: 'm', tolerance: 0.05 },
        { name: 'max_cutting_force', min: 0, max: 50, unit: 'N', tolerance: 2 },
      ],
      geo: { type: 'polygon', description: 'Row-by-row vineyard/orchard boundary — excludes equipment sheds, irrigation infrastructure, public access paths' },
      time: { operating_hours: '06:00-20:00', operating_days: [0,1,2,3,4,5,6], timezone: 'farm_local' },
      states: { allowed: ['idle','navigating_row','pruning','harvesting','inspecting','returning'], forbidden: ['human_in_arm_radius','row_end_exceeded'] },
      odd_description: 'Structured vineyard or orchard rows with GPS-guided navigation. System moves along defined row paths and performs precision tasks within arm reach envelope.',
      safety: { violation_action: 'block', fail_closed: true, arm_retract_on_human: true, emergency_stop: true },
    },
  },

  hazmat_inspection_robot: {
    label: 'Hazmat / CBRN Inspection Robot',
    domain: 'ground_robots',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 3, unit: 'km/h', tolerance: 0.5 },
        { name: 'max_radiation_exposure', min: 0, max: 100, unit: 'mSv/hr', tolerance: 5 },
        { name: 'max_chemical_concentration', min: 0, max: 500, unit: 'ppm', tolerance: 10 },
        { name: 'max_mission_duration', min: 0, max: 240, unit: 'min', tolerance: 5 },
      ],
      geo: { type: 'polygon', description: 'Designated hazmat zone with hot/warm/cold zone boundaries — robot must not exit hot zone without decontamination sequence' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'incident_local' },
      states: { allowed: ['standby','entering_zone','inspecting','sampling','retreating','decontaminating'], forbidden: ['human_follow_mode_in_hot_zone','sample_container_open_in_cold_zone'] },
      odd_description: 'Hazardous material incident scene with defined exclusion zones. Robot operates in contaminated environments where human entry is prohibited or limited. All actions logged for incident command.',
      safety: { violation_action: 'block', fail_closed: true, auto_retreat_on_threshold: true, emergency_stop: true },
    },
  },

  tunnel_inspection_robot: {
    label: 'Tunnel / Pipe Inspection Robot',
    domain: 'ground_robots',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 2, unit: 'km/h', tolerance: 0.2 },
        { name: 'min_pipe_diameter', min: 150, max: null, unit: 'mm', tolerance: 10 },
        { name: 'max_tether_length', min: 0, max: 500, unit: 'm', tolerance: 5 },
        { name: 'max_depth', min: 0, max: 100, unit: 'm', tolerance: 1 },
      ],
      geo: { type: 'linear', description: 'Defined tunnel or pipeline segment with entry/exit points — system must not exceed tether length or enter unmarked branches' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['standby','inserting','inspecting','retreating','data_upload'], forbidden: ['tether_tension_exceeded','communication_lost_advancing'] },
      odd_description: 'Confined pipe or tunnel environment with tethered operation. System advances along defined path, retreats on communication loss or tether limit. GPS-denied environment uses odometry and tether measurement.',
      safety: { violation_action: 'block', fail_closed: true, auto_retreat_on_comms_loss: true, emergency_stop: true },
    },
  },

  snow_removal_robot: {
    label: 'Snow Removal / Grounds Robot',
    domain: 'ground_robots',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 8, unit: 'km/h', tolerance: 0.5 },
        { name: 'max_plow_width', min: 0, max: 2, unit: 'm', tolerance: 0.05 },
        { name: 'min_temperature', min: -40, max: 5, unit: '°C', tolerance: 1 },
        { name: 'max_snow_depth', min: 0, max: 30, unit: 'cm', tolerance: 2 },
      ],
      geo: { type: 'polygon', description: 'Facility sidewalks and pathways — excludes vehicle lanes, building entrances during occupancy, garden areas' },
      time: { operating_hours: '03:00-07:00', operating_days: [0,1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['idle','plowing','salting','returning','charging'], forbidden: ['pedestrian_detected_ahead','ice_on_slope_above_grade_limit'] },
      odd_description: 'Outdoor facility pathways during winter conditions. System operates during low-traffic hours, clearing designated paths. Halts on pedestrian detection and avoids steep grades when icy.',
      safety: { violation_action: 'block', fail_closed: true, pedestrian_stop: true, emergency_stop: true },
    },
  },

  street_cleaning_robot: {
    label: 'Street Cleaning Robot',
    domain: 'ground_robots',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 8, unit: 'km/h', tolerance: 0.5 },
        { name: 'max_water_usage', min: 0, max: 500, unit: 'L/hr', tolerance: 10 },
        { name: 'max_noise_level', min: 0, max: 70, unit: 'dB', tolerance: 2 },
      ],
      geo: { type: 'polygon', description: 'Approved pedestrian zones, sidewalks, plazas — excludes vehicle roadways, private property, construction zones' },
      time: { operating_hours: '04:00-07:00', operating_days: [0,1,2,3,4,5,6], timezone: 'city_local' },
      states: { allowed: ['idle','cleaning','refilling','returning','charging'], forbidden: ['crowd_detected','event_zone_active'] },
      odd_description: 'Urban pedestrian infrastructure during low-traffic hours. System follows predefined cleaning routes on paved surfaces. Noise-limited operation during early morning hours.',
      safety: { violation_action: 'block', fail_closed: true, emergency_stop: true },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AERIAL SYSTEMS (UAV / UAS)
  // ══════════════════════════════════════════════════════════════════════════

  small_survey_drone: {
    label: 'Small Survey Drone (<25kg)',
    domain: 'aerial',
    template: {
      numeric: [
        { name: 'max_altitude_agl', min: 0, max: 120, unit: 'm', tolerance: 3 },
        { name: 'max_speed', min: 0, max: 60, unit: 'km/h', tolerance: 2 },
        { name: 'max_wind_speed', min: 0, max: 35, unit: 'km/h', tolerance: 2 },
        { name: 'min_battery_for_rtl', min: 25, max: null, unit: '%', tolerance: 3 },
        { name: 'max_range_from_pilot', min: 0, max: 500, unit: 'm', tolerance: 10 },
      ],
      geo: { type: 'polygon_3d', description: 'Approved flight zone with altitude ceiling — excludes airports, restricted airspace, populated areas per Part 107' },
      time: { operating_hours: '06:00-18:00', operating_days: [1,2,3,4,5], timezone: 'ops_local' },
      states: { allowed: ['grounded','takeoff','surveying','hovering','returning','landing'], forbidden: ['gps_lost_above_30m','battery_below_rtl_threshold','wind_exceeded'] },
      odd_description: 'Visual line of sight operations in Class G airspace below 400ft AGL. Operations in fair weather with wind below threshold. System maintains return-to-launch battery reserve at all times.',
      safety: { violation_action: 'block', fail_closed: true, auto_rtl: true, geofence_hard: true, emergency_stop: true },
    },
  },

  agricultural_spray_drone: {
    label: 'Agricultural Spray Drone',
    domain: 'aerial',
    template: {
      numeric: [
        { name: 'max_altitude_agl', min: 0, max: 15, unit: 'm', tolerance: 1 },
        { name: 'max_speed', min: 0, max: 25, unit: 'km/h', tolerance: 1 },
        { name: 'max_spray_rate', min: 0, max: 30, unit: 'L/min', tolerance: 1 },
        { name: 'max_wind_speed', min: 0, max: 15, unit: 'km/h', tolerance: 1 },
        { name: 'buffer_distance_waterway', min: 30, max: null, unit: 'm', tolerance: 3 },
      ],
      geo: { type: 'polygon', description: 'Defined field boundary with spray buffer zones around waterways, neighboring properties, and roads' },
      time: { operating_hours: '05:00-10:00', operating_days: [0,1,2,3,4,5,6], timezone: 'farm_local' },
      states: { allowed: ['grounded','spraying','transiting','refilling','returning'], forbidden: ['wind_exceeded_during_spray','over_buffer_zone','tank_empty_pumping'] },
      odd_description: 'Low-altitude precision spraying over defined agricultural fields. Early morning operations to minimize drift. Hard geofence around buffer zones with automatic spray shutoff.',
      safety: { violation_action: 'block', fail_closed: true, spray_auto_shutoff: true, geofence_hard: true, emergency_stop: true },
    },
  },

  infrastructure_inspection_drone: {
    label: 'Infrastructure Inspection Drone',
    domain: 'aerial',
    template: {
      numeric: [
        { name: 'max_altitude_agl', min: 0, max: 150, unit: 'm', tolerance: 3 },
        { name: 'max_speed', min: 0, max: 40, unit: 'km/h', tolerance: 2 },
        { name: 'min_structure_clearance', min: 3, max: null, unit: 'm', tolerance: 0.5 },
        { name: 'max_wind_speed', min: 0, max: 30, unit: 'km/h', tolerance: 2 },
      ],
      geo: { type: 'polygon_3d', description: 'Approved inspection corridor around structure — includes buffer zones from public areas, roads, and occupied buildings' },
      time: { operating_hours: '07:00-17:00', operating_days: [1,2,3,4,5], timezone: 'ops_local' },
      states: { allowed: ['grounded','en_route','inspecting','hovering','returning','landing'], forbidden: ['proximity_alert_structure','gps_degraded_near_structure'] },
      odd_description: 'Close-range inspection of bridges, towers, power lines, or buildings. Controlled airspace with NOTAM. System maintains minimum clearance from structure and auto-returns on sensor degradation.',
      safety: { violation_action: 'block', fail_closed: true, auto_rtl: true, collision_avoidance: true, emergency_stop: true },
    },
  },

  delivery_drone_urban: {
    label: 'Delivery Drone (Urban)',
    domain: 'aerial',
    template: {
      numeric: [
        { name: 'max_altitude_agl', min: 0, max: 120, unit: 'm', tolerance: 3 },
        { name: 'max_speed', min: 0, max: 70, unit: 'km/h', tolerance: 2 },
        { name: 'max_payload', min: 0, max: 5, unit: 'kg', tolerance: 0.2 },
        { name: 'max_wind_speed', min: 0, max: 30, unit: 'km/h', tolerance: 2 },
        { name: 'min_battery_for_rtl', min: 30, max: null, unit: '%', tolerance: 3 },
      ],
      geo: { type: 'corridor', description: 'Approved flight corridors between depot and delivery zones — excludes restricted airspace, schools, hospitals, crowd areas' },
      time: { operating_hours: '08:00-20:00', operating_days: [0,1,2,3,4,5,6], timezone: 'delivery_zone_local' },
      states: { allowed: ['grounded','en_route','hovering_delivery','descending','returning','landing'], forbidden: ['crowd_below','restricted_airspace_entered','battery_below_rtl'] },
      odd_description: 'Urban drone delivery along approved corridors in controlled low-altitude airspace. System avoids populated areas during transit, descends only at approved delivery points. Hard geofence on all corridor boundaries.',
      safety: { violation_action: 'block', fail_closed: true, auto_rtl: true, geofence_hard: true, parachute_deploy: true, emergency_stop: true },
    },
  },

  delivery_drone_rural: {
    label: 'Delivery Drone (Rural / Suburban)',
    domain: 'aerial',
    template: {
      numeric: [
        { name: 'max_altitude_agl', min: 0, max: 120, unit: 'm', tolerance: 3 },
        { name: 'max_speed', min: 0, max: 90, unit: 'km/h', tolerance: 3 },
        { name: 'max_payload', min: 0, max: 10, unit: 'kg', tolerance: 0.5 },
        { name: 'max_range', min: 0, max: 30, unit: 'km', tolerance: 1 },
        { name: 'max_wind_speed', min: 0, max: 35, unit: 'km/h', tolerance: 2 },
      ],
      geo: { type: 'corridor', description: 'Approved rural flight paths — avoids populated areas, livestock, and restricted airspace' },
      time: { operating_hours: '06:00-20:00', operating_days: [0,1,2,3,4,5,6], timezone: 'ops_local' },
      states: { allowed: ['grounded','en_route','delivering','returning','diverting','landing'], forbidden: ['thunderstorm_detected','beyond_range_for_rtl'] },
      odd_description: 'Rural and suburban delivery routes with extended range. Lower population density allows broader corridors. System maintains energy reserve for full return at all decision points.',
      safety: { violation_action: 'block', fail_closed: true, auto_rtl: true, geofence_hard: true, emergency_stop: true },
    },
  },

  search_rescue_drone: {
    label: 'Search & Rescue Drone',
    domain: 'aerial',
    template: {
      numeric: [
        { name: 'max_altitude_agl', min: 0, max: 200, unit: 'm', tolerance: 5 },
        { name: 'max_speed', min: 0, max: 80, unit: 'km/h', tolerance: 3 },
        { name: 'max_wind_speed', min: 0, max: 45, unit: 'km/h', tolerance: 3 },
        { name: 'max_mission_duration', min: 0, max: 45, unit: 'min', tolerance: 2 },
      ],
      geo: { type: 'polygon_3d', description: 'Defined search area as authorized by incident command — excludes active fire zones, other aircraft operating areas' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'incident_local' },
      states: { allowed: ['grounded','searching','hovering_target','payload_drop','returning','landing'], forbidden: ['fire_zone_entered','other_aircraft_proximity'] },
      odd_description: 'Emergency search operations in defined area under incident command authority. Extended weather envelope. System coordinates with manned aircraft via ADS-B and maintains deconfliction boundaries.',
      safety: { violation_action: 'block', fail_closed: true, auto_rtl: true, deconfliction: true, emergency_stop: true },
    },
  },

  power_line_inspection_drone: {
    label: 'Power Line Inspection Drone',
    domain: 'aerial',
    template: {
      numeric: [
        { name: 'max_altitude_agl', min: 0, max: 120, unit: 'm', tolerance: 3 },
        { name: 'max_speed', min: 0, max: 30, unit: 'km/h', tolerance: 1 },
        { name: 'min_line_clearance', min: 5, max: null, unit: 'm', tolerance: 0.5 },
        { name: 'max_emf_exposure', min: 0, max: 100, unit: 'V/m', tolerance: 5 },
      ],
      geo: { type: 'corridor', description: 'Power line right-of-way corridor — excludes residential areas beyond ROW, substations during maintenance' },
      time: { operating_hours: '07:00-17:00', operating_days: [1,2,3,4,5], timezone: 'ops_local' },
      states: { allowed: ['grounded','transiting','inspecting','hovering','returning','landing'], forbidden: ['min_clearance_violated','emf_exceeded','gps_lost'] },
      odd_description: 'Linear corridor following power line rights-of-way. System maintains safe clearance from energized lines and auto-retreats on EMF threshold exceedance. BVLOS operations under waiver.',
      safety: { violation_action: 'block', fail_closed: true, auto_rtl: true, emf_protection: true, emergency_stop: true },
    },
  },

  pipeline_inspection_drone: {
    label: 'Pipeline Inspection Drone',
    domain: 'aerial',
    template: {
      numeric: [
        { name: 'max_altitude_agl', min: 0, max: 100, unit: 'm', tolerance: 3 },
        { name: 'max_speed', min: 0, max: 50, unit: 'km/h', tolerance: 2 },
        { name: 'max_range', min: 0, max: 50, unit: 'km', tolerance: 2 },
        { name: 'min_ground_clearance', min: 15, max: null, unit: 'm', tolerance: 2 },
      ],
      geo: { type: 'corridor', description: 'Pipeline right-of-way corridor with lateral buffer — excludes populated areas, restricted airspace, water crossings during sensitive periods' },
      time: { operating_hours: '06:00-18:00', operating_days: [1,2,3,4,5], timezone: 'ops_local' },
      states: { allowed: ['grounded','transiting','inspecting','leak_detected_hovering','returning','landing'], forbidden: ['off_corridor','low_fuel_advancing'] },
      odd_description: 'Extended linear inspection along pipeline routes. BVLOS operations with relay communication. System follows pipeline corridor with automatic anomaly detection and reporting.',
      safety: { violation_action: 'block', fail_closed: true, auto_rtl: true, geofence_hard: true, emergency_stop: true },
    },
  },

  mapping_photogrammetry_drone: {
    label: 'Mapping / Photogrammetry Drone',
    domain: 'aerial',
    template: {
      numeric: [
        { name: 'max_altitude_agl', min: 0, max: 120, unit: 'm', tolerance: 3 },
        { name: 'max_speed', min: 0, max: 50, unit: 'km/h', tolerance: 2 },
        { name: 'max_wind_speed', min: 0, max: 25, unit: 'km/h', tolerance: 2 },
        { name: 'min_overlap', min: 60, max: null, unit: '%', tolerance: 5 },
      ],
      geo: { type: 'polygon_3d', description: 'Defined survey area boundary — excludes neighboring properties, sensitive sites, restricted airspace' },
      time: { operating_hours: '09:00-15:00', operating_days: [1,2,3,4,5], timezone: 'ops_local' },
      states: { allowed: ['grounded','en_route','mapping','returning','landing'], forbidden: ['shadow_angle_exceeded','cloud_cover_above_80pct'] },
      odd_description: 'Systematic grid pattern flight over defined survey area for photogrammetric capture. Optimal lighting conditions required. System maintains overlap requirements and compensates for wind drift.',
      safety: { violation_action: 'block', fail_closed: true, auto_rtl: true, geofence_hard: true, emergency_stop: true },
    },
  },

  urban_air_mobility_evtol: {
    label: 'Urban Air Mobility (eVTOL Passenger)',
    domain: 'aerial',
    template: {
      numeric: [
        { name: 'max_altitude_msl', min: 0, max: 1500, unit: 'ft', tolerance: 50 },
        { name: 'max_speed', min: 0, max: 250, unit: 'km/h', tolerance: 5 },
        { name: 'max_passengers', min: 0, max: 6, unit: 'persons', tolerance: 0 },
        { name: 'max_wind_speed', min: 0, max: 50, unit: 'km/h', tolerance: 3 },
        { name: 'min_battery_for_alternate', min: 20, max: null, unit: '%', tolerance: 2 },
      ],
      geo: { type: 'corridor_3d', description: 'Approved UAM corridors between vertiports — includes approach/departure paths, excludes restricted airspace, noise-sensitive zones' },
      time: { operating_hours: '06:00-22:00', operating_days: [0,1,2,3,4,5,6], timezone: 'ops_local' },
      states: { allowed: ['parked','boarding','takeoff','cruise','approach','landing','disembarking'], forbidden: ['battery_below_alternate_reserve','icing_detected','passenger_door_open_in_flight'] },
      odd_description: 'Urban air mobility corridors between certified vertiports. System operates under Part 135 equivalent with full ATC integration. Maintains alternate landing site energy reserve at all times.',
      safety: { violation_action: 'block', fail_closed: true, auto_divert: true, redundant_flight_controls: true, emergency_stop: false },
    },
  },

  cargo_evtol: {
    label: 'Cargo eVTOL',
    domain: 'aerial',
    template: {
      numeric: [
        { name: 'max_altitude_msl', min: 0, max: 1000, unit: 'ft', tolerance: 50 },
        { name: 'max_speed', min: 0, max: 200, unit: 'km/h', tolerance: 5 },
        { name: 'max_payload', min: 0, max: 500, unit: 'kg', tolerance: 5 },
        { name: 'max_range', min: 0, max: 150, unit: 'km', tolerance: 5 },
      ],
      geo: { type: 'corridor_3d', description: 'Approved cargo flight corridors between distribution hubs — avoids populated areas during cruise' },
      time: { operating_hours: '05:00-23:00', operating_days: [0,1,2,3,4,5,6], timezone: 'ops_local' },
      states: { allowed: ['parked','loading','takeoff','cruise','approach','landing','unloading'], forbidden: ['overweight','center_of_gravity_exceeded','icing_detected'] },
      odd_description: 'Point-to-point cargo transport between approved landing sites. Unpopulated corridors preferred. System verifies weight and balance before each flight and maintains energy reserves.',
      safety: { violation_action: 'block', fail_closed: true, auto_divert: true, geofence_hard: true, emergency_stop: false },
    },
  },

  firefighting_drone: {
    label: 'Firefighting Support Drone',
    domain: 'aerial',
    template: {
      numeric: [
        { name: 'max_altitude_agl', min: 0, max: 200, unit: 'm', tolerance: 5 },
        { name: 'max_speed', min: 0, max: 70, unit: 'km/h', tolerance: 3 },
        { name: 'max_thermal_exposure', min: 0, max: 200, unit: '°C', tolerance: 10 },
        { name: 'max_wind_speed', min: 0, max: 50, unit: 'km/h', tolerance: 3 },
      ],
      geo: { type: 'polygon_3d', description: 'Incident command designated airspace — deconflicted from manned aircraft, excludes active drop zones' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'incident_local' },
      states: { allowed: ['grounded','scouting','monitoring','thermal_mapping','returning','landing'], forbidden: ['manned_aircraft_proximity','thermal_limit_exceeded'] },
      odd_description: 'Fire incident support under incident command authority. Thermal imaging and situational awareness only — no suppression. Deconflicted from manned firefighting aircraft at all times.',
      safety: { violation_action: 'block', fail_closed: true, auto_rtl: true, thermal_protection: true, emergency_stop: true },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AUTONOMOUS VEHICLES & MOBILITY
  // ══════════════════════════════════════════════════════════════════════════

  highway_l4_truck_longhaul: {
    label: 'Highway L4 Truck (Long-Haul)',
    domain: 'vehicles',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 105, unit: 'km/h', tolerance: 2 },
        { name: 'max_gvw', min: 0, max: 36000, unit: 'kg', tolerance: 100 },
        { name: 'min_following_distance', min: 2.5, max: null, unit: 's', tolerance: 0.2 },
        { name: 'max_wind_speed', min: 0, max: 80, unit: 'km/h', tolerance: 5 },
        { name: 'min_visibility', min: 200, max: null, unit: 'm', tolerance: 20 },
      ],
      geo: { type: 'road_network', description: 'Approved interstate highway segments — excludes urban interchanges, construction zones, mountain passes above grade limit' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'route_local' },
      states: { allowed: ['parked','highway_cruise','lane_change','merging','exiting','minimal_risk_condition'], forbidden: ['urban_street','construction_zone','visibility_below_minimum','ice_detected'] },
      odd_description: 'Interstate highway operations on approved segments. L4 autonomy with no human driver. System transitions to minimal risk condition (MRC) on any ODD exit. Pre-mapped route with known infrastructure.',
      safety: { violation_action: 'block', fail_closed: true, mrc_pullover: true, v2x_enabled: true, emergency_stop: true },
    },
  },

  highway_l4_truck_regional: {
    label: 'Highway L4 Truck (Regional)',
    domain: 'vehicles',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 90, unit: 'km/h', tolerance: 2 },
        { name: 'max_gvw', min: 0, max: 26000, unit: 'kg', tolerance: 100 },
        { name: 'min_following_distance', min: 2, max: null, unit: 's', tolerance: 0.2 },
        { name: 'max_route_length', min: 0, max: 300, unit: 'km', tolerance: 10 },
      ],
      geo: { type: 'road_network', description: 'Approved regional highway and arterial segments — includes transfer hub access roads' },
      time: { operating_hours: '04:00-22:00', operating_days: [1,2,3,4,5,6], timezone: 'route_local' },
      states: { allowed: ['parked','highway_cruise','arterial_drive','hub_approach','loading','unloading','mrc'], forbidden: ['residential_street','school_zone','unpaved_road'] },
      odd_description: 'Regional distribution routes on approved highways and arterials. Shorter segments with more frequent stops. System handles hub ingress/egress on pre-mapped facility roads.',
      safety: { violation_action: 'block', fail_closed: true, mrc_pullover: true, emergency_stop: true },
    },
  },

  urban_robotaxi: {
    label: 'Urban Robotaxi',
    domain: 'vehicles',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 60, unit: 'km/h', tolerance: 2 },
        { name: 'max_passengers', min: 0, max: 4, unit: 'persons', tolerance: 0 },
        { name: 'min_visibility', min: 100, max: null, unit: 'm', tolerance: 10 },
        { name: 'max_precipitation_rate', min: 0, max: 10, unit: 'mm/hr', tolerance: 1 },
      ],
      geo: { type: 'road_network', description: 'Approved urban street network with pickup/dropoff zones — excludes highways, unpaved roads, restricted zones' },
      time: { operating_hours: '05:00-01:00', operating_days: [0,1,2,3,4,5,6], timezone: 'city_local' },
      states: { allowed: ['parked','cruising','passenger_pickup','passenger_transit','dropoff','repositioning','mrc'], forbidden: ['freeway_entered','visibility_degraded','door_open_moving'] },
      odd_description: 'Dense urban street environment with mixed traffic, pedestrians, cyclists. L4 autonomy on mapped city streets. System handles intersections, traffic signals, and complex urban scenarios within speed and weather limits.',
      safety: { violation_action: 'block', fail_closed: true, mrc_pullover: true, passenger_interlock: true, emergency_stop: true },
    },
  },

  suburban_robotaxi: {
    label: 'Suburban Robotaxi',
    domain: 'vehicles',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 80, unit: 'km/h', tolerance: 2 },
        { name: 'max_passengers', min: 0, max: 4, unit: 'persons', tolerance: 0 },
        { name: 'min_visibility', min: 150, max: null, unit: 'm', tolerance: 10 },
      ],
      geo: { type: 'road_network', description: 'Approved suburban road network including arterials and residential streets — excludes highways, rural roads' },
      time: { operating_hours: '05:00-00:00', operating_days: [0,1,2,3,4,5,6], timezone: 'city_local' },
      states: { allowed: ['parked','cruising','pickup','transit','dropoff','repositioning','mrc'], forbidden: ['highway_entered','unpaved_road','school_zone_during_hours'] },
      odd_description: 'Suburban mixed-use road environment. Lower traffic density than urban, higher speed limits. System operates on mapped residential and arterial roads with school zone awareness.',
      safety: { violation_action: 'block', fail_closed: true, mrc_pullover: true, emergency_stop: true },
    },
  },

  fixed_route_autonomous_bus: {
    label: 'Fixed-Route Autonomous Bus',
    domain: 'vehicles',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 50, unit: 'km/h', tolerance: 2 },
        { name: 'max_passengers', min: 0, max: 40, unit: 'persons', tolerance: 0 },
        { name: 'max_grade', min: 0, max: 12, unit: '%', tolerance: 0.5 },
      ],
      geo: { type: 'route', description: 'Fixed transit route with designated stops — no deviation from approved route under any circumstances' },
      time: { operating_hours: '05:00-23:00', operating_days: [0,1,2,3,4,5,6], timezone: 'transit_local' },
      states: { allowed: ['depot','en_route','stopped_at_station','loading','unloading','returning_depot','mrc'], forbidden: ['off_route','door_open_moving','passenger_count_exceeded'] },
      odd_description: 'Fixed transit route on public roads with designated bus stops. System follows exact route with no autonomous deviation. Passenger loading/unloading at stops only with door interlocks.',
      safety: { violation_action: 'block', fail_closed: true, mrc_pullover: true, door_interlock: true, emergency_stop: true },
    },
  },

  airport_shuttle_airside: {
    label: 'Airport Shuttle (Airside)',
    domain: 'vehicles',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 30, unit: 'km/h', tolerance: 1 },
        { name: 'max_passengers', min: 0, max: 20, unit: 'persons', tolerance: 0 },
        { name: 'min_aircraft_clearance', min: 10, max: null, unit: 'm', tolerance: 1 },
      ],
      geo: { type: 'route', description: 'Approved airside taxiway and apron routes — deconflicted from active runways and taxiways' },
      time: { operating_hours: '04:00-01:00', operating_days: [0,1,2,3,4,5,6], timezone: 'airport_local' },
      states: { allowed: ['parked','en_route','at_gate','loading','unloading'], forbidden: ['active_runway_proximity','aircraft_pushback_zone'] },
      odd_description: 'Airport airside operations on controlled surface routes. System integrates with airport surface management and maintains clearance from all aircraft operations. Speed limited to airside regulations.',
      safety: { violation_action: 'block', fail_closed: true, atc_integration: true, emergency_stop: true },
    },
  },

  airport_shuttle_landside: {
    label: 'Airport Shuttle (Landside)',
    domain: 'vehicles',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 40, unit: 'km/h', tolerance: 1 },
        { name: 'max_passengers', min: 0, max: 30, unit: 'persons', tolerance: 0 },
      ],
      geo: { type: 'route', description: 'Terminal-to-parking/rental fixed route — excludes active roadways, departure lanes' },
      time: { operating_hours: '04:00-01:00', operating_days: [0,1,2,3,4,5,6], timezone: 'airport_local' },
      states: { allowed: ['parked','en_route','at_stop','loading','unloading','returning'], forbidden: ['off_route','departure_lane_entered'] },
      odd_description: 'Fixed route between airport terminals and parking/rental facilities on landside roads. Controlled low-speed environment with dedicated lanes where possible.',
      safety: { violation_action: 'block', fail_closed: true, door_interlock: true, emergency_stop: true },
    },
  },

  port_terminal_tractor: {
    label: 'Port Terminal Tractor (Yard Truck)',
    domain: 'vehicles',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 25, unit: 'km/h', tolerance: 1 },
        { name: 'max_tow_weight', min: 0, max: 80000, unit: 'kg', tolerance: 500 },
        { name: 'min_container_clearance', min: 1, max: null, unit: 'm', tolerance: 0.1 },
      ],
      geo: { type: 'polygon', description: 'Port terminal yard boundary — approved lanes between crane positions and stacking areas' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'port_local' },
      states: { allowed: ['parked','empty_transit','loaded_transit','crane_position','stacking_position','charging'], forbidden: ['public_road','human_zone_speed_exceeded','unstable_load'] },
      odd_description: 'Closed port terminal environment with controlled traffic. System transports containers between cranes and stacking areas on predefined yard lanes. No public road interaction.',
      safety: { violation_action: 'block', fail_closed: true, load_stability_check: true, emergency_stop: true },
    },
  },

  mining_site_vehicle: {
    label: 'Mining Site Autonomous Vehicle',
    domain: 'vehicles',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 60, unit: 'km/h', tolerance: 2 },
        { name: 'max_payload', min: 0, max: 400000, unit: 'kg', tolerance: 1000 },
        { name: 'max_grade', min: 0, max: 15, unit: '%', tolerance: 0.5 },
        { name: 'min_edge_distance', min: 5, max: null, unit: 'm', tolerance: 0.5 },
      ],
      geo: { type: 'polygon', description: 'Mine site operational boundary — approved haul roads, pit zones, dump areas — excludes blast zones, maintenance areas during service' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'mine_local' },
      states: { allowed: ['parked','hauling_loaded','hauling_empty','loading','dumping','fueling'], forbidden: ['blast_zone_active','maintenance_area','edge_proximity_exceeded'] },
      odd_description: 'Open-pit or underground mine with controlled vehicle traffic. Haul trucks operate on designated mine roads with edge detection. System integrates with mine dispatch and blast management.',
      safety: { violation_action: 'block', fail_closed: true, edge_protection: true, blast_zone_interlock: true, emergency_stop: true },
    },
  },

  valet_parking_system: {
    label: 'Automated Valet Parking',
    domain: 'vehicles',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 10, unit: 'km/h', tolerance: 0.5 },
        { name: 'max_steering_angle', min: 0, max: 40, unit: 'degrees', tolerance: 1 },
        { name: 'min_obstacle_clearance', min: 0.2, max: null, unit: 'm', tolerance: 0.05 },
      ],
      geo: { type: 'polygon', description: 'Parking structure or lot boundary — approved driving lanes and parking spaces only' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['parked','maneuvering_to_spot','maneuvering_to_pickup','waiting_at_pickup'], forbidden: ['pedestrian_detected','exit_lane_blocked','slope_exceeded'] },
      odd_description: 'Controlled parking facility environment. Vehicle self-parks and self-retrieves at very low speed. Facility must be mapped and infrastructure-equipped. No pedestrians allowed in autonomous zone.',
      safety: { violation_action: 'block', fail_closed: true, pedestrian_stop: true, ultra_low_speed: true, emergency_stop: true },
    },
  },

  low_speed_neighborhood_ev: {
    label: 'Low-Speed Neighborhood EV',
    domain: 'vehicles',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 40, unit: 'km/h', tolerance: 1 },
        { name: 'max_passengers', min: 0, max: 6, unit: 'persons', tolerance: 0 },
        { name: 'max_road_speed_limit', min: 0, max: 45, unit: 'km/h', tolerance: 0 },
      ],
      geo: { type: 'road_network', description: 'Neighborhood streets with posted speed limits ≤45 km/h — excludes arterials, highways, roads without sidewalks' },
      time: { operating_hours: '06:00-22:00', operating_days: [0,1,2,3,4,5,6], timezone: 'community_local' },
      states: { allowed: ['parked','cruising','pickup','dropoff','charging','mrc'], forbidden: ['arterial_road','night_unlighted_road','heavy_rain'] },
      odd_description: 'Residential neighborhood and retirement community streets. Low-speed vehicle class per FMVSS. Operates only on roads with posted speed limits at or below vehicle max speed.',
      safety: { violation_action: 'block', fail_closed: true, mrc_pullover: true, emergency_stop: true },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MARINE & MARITIME
  // ══════════════════════════════════════════════════════════════════════════

  autonomous_cargo_vessel_coastal: {
    label: 'Autonomous Cargo Vessel (Coastal)',
    domain: 'marine',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 15, unit: 'knots', tolerance: 0.5 },
        { name: 'max_sea_state', min: 0, max: 5, unit: 'Beaufort', tolerance: 0 },
        { name: 'max_draft', min: 0, max: 8, unit: 'm', tolerance: 0.1 },
        { name: 'min_under_keel_clearance', min: 2, max: null, unit: 'm', tolerance: 0.2 },
      ],
      geo: { type: 'corridor', description: 'Approved coastal shipping lanes — excludes TSS separation zones, marine protected areas, port approaches without pilot' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'UTC' },
      states: { allowed: ['moored','departing','underway','approaching','anchored','mrc'], forbidden: ['sea_state_exceeded','visibility_below_1nm','traffic_density_exceeded'] },
      odd_description: 'Coastal shipping routes within 50nm of shore. System follows COLREG rules, maintains AIS broadcast, and transitions to remote operator handoff in congested waters. IMO MASS Level 3.',
      safety: { violation_action: 'block', fail_closed: true, colreg_compliance: true, remote_handoff: true, emergency_stop: false },
    },
  },

  autonomous_cargo_vessel_ocean: {
    label: 'Autonomous Cargo Vessel (Ocean)',
    domain: 'marine',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 20, unit: 'knots', tolerance: 0.5 },
        { name: 'max_sea_state', min: 0, max: 7, unit: 'Beaufort', tolerance: 0 },
        { name: 'max_roll_angle', min: 0, max: 30, unit: 'degrees', tolerance: 2 },
        { name: 'min_stability_gm', min: 0.5, max: null, unit: 'm', tolerance: 0.05 },
      ],
      geo: { type: 'corridor', description: 'Ocean routing corridors — avoids ice zones, piracy high-risk areas, environmentally sensitive waters per IMO designations' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'UTC' },
      states: { allowed: ['moored','departing','ocean_transit','weather_routing','approaching','anchored'], forbidden: ['stability_compromised','communication_lost_48hr','ice_zone_entered'] },
      odd_description: 'Trans-oceanic shipping routes. Fully autonomous with shore-based remote monitoring. System performs weather routing optimization within approved corridor. COLREG compliant with enhanced collision avoidance.',
      safety: { violation_action: 'block', fail_closed: true, colreg_compliance: true, weather_routing: true, emergency_stop: false },
    },
  },

  port_crane_system: {
    label: 'Automated Port Crane (STS/RTG)',
    domain: 'marine',
    template: {
      numeric: [
        { name: 'max_hoist_speed', min: 0, max: 90, unit: 'm/min', tolerance: 2 },
        { name: 'max_trolley_speed', min: 0, max: 240, unit: 'm/min', tolerance: 5 },
        { name: 'max_gantry_speed', min: 0, max: 45, unit: 'm/min', tolerance: 2 },
        { name: 'max_wind_speed', min: 0, max: 72, unit: 'km/h', tolerance: 3 },
        { name: 'max_lift_weight', min: 0, max: 65, unit: 'tonnes', tolerance: 1 },
      ],
      geo: { type: 'linear', description: 'Crane rail span and apron reach — excludes adjacent crane working zones, vessel superstructure clearance zones' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'port_local' },
      states: { allowed: ['idle','lifting','lowering','trolleying','gantry_moving','container_placing'], forbidden: ['wind_exceeded','anti_collision_triggered','overload_detected','personnel_in_zone'] },
      odd_description: 'Port container terminal crane operations. System handles container lift/place cycles within defined crane envelope. Anti-collision zones with adjacent cranes enforced. Wind speed limits enforced with automatic shutdown.',
      safety: { violation_action: 'block', fail_closed: true, anti_collision: true, overload_protection: true, emergency_stop: true },
    },
  },

  container_yard_agv: {
    label: 'Container Yard AGV',
    domain: 'marine',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 20, unit: 'km/h', tolerance: 1 },
        { name: 'max_payload', min: 0, max: 70000, unit: 'kg', tolerance: 500 },
        { name: 'min_obstacle_distance', min: 2, max: null, unit: 'm', tolerance: 0.2 },
      ],
      geo: { type: 'polygon', description: 'Container yard lane network — approved travel lanes between crane positions and stacking blocks' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'port_local' },
      states: { allowed: ['parked','empty_transit','loaded_transit','crane_exchange','charging'], forbidden: ['personnel_zone','off_lane','unstable_load'] },
      odd_description: 'Closed container terminal yard with controlled traffic. AGVs transport containers between quay cranes and yard stacking equipment on predefined lane network.',
      safety: { violation_action: 'block', fail_closed: true, personnel_detection: true, emergency_stop: true },
    },
  },

  autonomous_tugboat: {
    label: 'Autonomous Tugboat',
    domain: 'marine',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 14, unit: 'knots', tolerance: 0.5 },
        { name: 'max_bollard_pull', min: 0, max: 80, unit: 'tonnes', tolerance: 2 },
        { name: 'max_wind_speed', min: 0, max: 50, unit: 'knots', tolerance: 2 },
        { name: 'max_current', min: 0, max: 4, unit: 'knots', tolerance: 0.2 },
      ],
      geo: { type: 'polygon', description: 'Port harbor and approach channel — approved escort and assist zones' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'port_local' },
      states: { allowed: ['moored','transiting','escort_position','assisting','standby','returning'], forbidden: ['towline_overload','sea_state_exceeded','vessel_communication_lost'] },
      odd_description: 'Port harbor tug operations for vessel assist and escort. System operates in close proximity to large vessels under port control coordination. Remote operator oversight for all assist maneuvers.',
      safety: { violation_action: 'block', fail_closed: true, towline_monitor: true, remote_handoff: true, emergency_stop: true },
    },
  },

  underwater_auv_inspection: {
    label: 'Underwater AUV (Inspection)',
    domain: 'marine',
    template: {
      numeric: [
        { name: 'max_depth', min: 0, max: 300, unit: 'm', tolerance: 5 },
        { name: 'max_speed', min: 0, max: 4, unit: 'knots', tolerance: 0.2 },
        { name: 'max_mission_duration', min: 0, max: 12, unit: 'hr', tolerance: 0.5 },
        { name: 'min_battery_for_surface', min: 20, max: null, unit: '%', tolerance: 3 },
      ],
      geo: { type: 'polygon_3d', description: 'Defined underwater inspection zone around target structure — exclusion zones around intake/outflow, shipping lanes overhead' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'ops_local' },
      states: { allowed: ['surface','diving','inspecting','transiting','ascending','recovery'], forbidden: ['battery_below_surface_reserve','depth_exceeded','communication_timeout'] },
      odd_description: 'Underwater inspection of subsea infrastructure (pipelines, platforms, hulls). Tethered or free-swimming within defined zone. System maintains energy reserve for safe surfacing at all times.',
      safety: { violation_action: 'block', fail_closed: true, auto_surface: true, depth_limiter: true, emergency_stop: false },
    },
  },

  underwater_auv_survey: {
    label: 'Underwater AUV (Survey / Mapping)',
    domain: 'marine',
    template: {
      numeric: [
        { name: 'max_depth', min: 0, max: 6000, unit: 'm', tolerance: 10 },
        { name: 'max_speed', min: 0, max: 5, unit: 'knots', tolerance: 0.2 },
        { name: 'max_mission_duration', min: 0, max: 72, unit: 'hr', tolerance: 1 },
        { name: 'max_range', min: 0, max: 200, unit: 'km', tolerance: 5 },
      ],
      geo: { type: 'polygon_3d', description: 'Defined survey grid with depth ceiling/floor — avoids shipping lanes, fishing grounds, protected marine areas' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'UTC' },
      states: { allowed: ['surface','diving','surveying','transiting','ascending','recovery_wait'], forbidden: ['depth_exceeded','energy_below_return_threshold','off_grid'] },
      odd_description: 'Deep-water autonomous survey operations. Extended duration missions with pre-programmed grid patterns. System surfaces on completion or energy threshold. No real-time control in deep operations.',
      safety: { violation_action: 'block', fail_closed: true, auto_surface: true, depth_limiter: true, emergency_stop: false },
    },
  },

  autonomous_ferry: {
    label: 'Autonomous Ferry',
    domain: 'marine',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 12, unit: 'knots', tolerance: 0.5 },
        { name: 'max_passengers', min: 0, max: 150, unit: 'persons', tolerance: 0 },
        { name: 'max_wind_speed', min: 0, max: 40, unit: 'knots', tolerance: 2 },
        { name: 'max_wave_height', min: 0, max: 1.5, unit: 'm', tolerance: 0.1 },
      ],
      geo: { type: 'corridor', description: 'Fixed ferry route between terminals — approved transit corridor with exclusion from shipping lanes' },
      time: { operating_hours: '06:00-22:00', operating_days: [0,1,2,3,4,5,6], timezone: 'port_local' },
      states: { allowed: ['moored','loading','departing','underway','arriving','unloading'], forbidden: ['sea_state_exceeded','passenger_on_deck_during_transit','off_corridor'] },
      odd_description: 'Fixed-route passenger ferry between two terminals. Short crossing in sheltered or semi-sheltered waters. System follows predefined route with COLREG compliance and weather-based operational limits.',
      safety: { violation_action: 'block', fail_closed: true, colreg_compliance: true, passenger_safety: true, emergency_stop: true },
    },
  },

  aquaculture_robot: {
    label: 'Aquaculture Robot',
    domain: 'marine',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 3, unit: 'knots', tolerance: 0.2 },
        { name: 'max_depth', min: 0, max: 30, unit: 'm', tolerance: 1 },
        { name: 'max_feed_rate', min: 0, max: 500, unit: 'kg/hr', tolerance: 10 },
      ],
      geo: { type: 'polygon_3d', description: 'Fish farm cage/pen boundaries — excludes neighboring pens, mooring lines, net edges' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'farm_local' },
      states: { allowed: ['docked','feeding','inspecting','net_cleaning','monitoring','returning'], forbidden: ['net_contact','fish_mortality_spike','current_exceeded'] },
      odd_description: 'Marine aquaculture installation with defined cage structures. System operates within and around fish pens for feeding, inspection, and net maintenance. Tethered or cage-bounded operation.',
      safety: { violation_action: 'block', fail_closed: true, net_proximity: true, emergency_stop: true },
    },
  },

  surface_survey_vessel: {
    label: 'Autonomous Surface Survey Vessel',
    domain: 'marine',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 8, unit: 'knots', tolerance: 0.3 },
        { name: 'max_sea_state', min: 0, max: 4, unit: 'Beaufort', tolerance: 0 },
        { name: 'max_range', min: 0, max: 100, unit: 'km', tolerance: 5 },
        { name: 'max_mission_duration', min: 0, max: 48, unit: 'hr', tolerance: 2 },
      ],
      geo: { type: 'polygon', description: 'Defined survey area — excludes shipping lanes, restricted zones, shallow water below draft' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'UTC' },
      states: { allowed: ['moored','transiting','surveying','station_keeping','returning'], forbidden: ['sea_state_exceeded','shipping_lane_entered','communication_lost_2hr'] },
      odd_description: 'Surface vessel conducting hydrographic or environmental survey in defined area. COLREG compliant with AIS. System follows pre-programmed survey pattern and returns on weather degradation.',
      safety: { violation_action: 'block', fail_closed: true, colreg_compliance: true, auto_return: true, emergency_stop: false },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MEDICAL & HEALTHCARE
  // ══════════════════════════════════════════════════════════════════════════

  surgical_robot_orthopedic: {
    label: 'Surgical Robot (Orthopedic)',
    domain: 'medical',
    template: {
      numeric: [
        { name: 'max_cutting_force', min: 0, max: 50, unit: 'N', tolerance: 1 },
        { name: 'max_cutting_depth', min: 0, max: 15, unit: 'mm', tolerance: 0.1 },
        { name: 'positional_accuracy', min: 0, max: 0.5, unit: 'mm', tolerance: 0.05 },
        { name: 'max_joint_velocity', min: 0, max: 100, unit: 'mm/s', tolerance: 2 },
      ],
      geo: { type: 'volume', description: 'Surgical workspace envelope defined by pre-operative plan — hard boundaries around critical anatomy (nerves, vessels)' },
      time: { operating_hours: '06:00-22:00', operating_days: [1,2,3,4,5], timezone: 'hospital_local' },
      states: { allowed: ['powered_off','initializing','registered','cutting','paused','retracting','complete'], forbidden: ['registration_lost','force_limit_exceeded','outside_planned_volume'] },
      odd_description: 'Operating room environment with patient-registered coordinate system. Robot executes pre-planned bone cuts within defined volume. Surgeon maintains supervisory control and can override at any time. FDA Class II/III.',
      safety: { violation_action: 'block', fail_closed: true, force_limiting: true, surgeon_override: true, emergency_stop: true },
    },
  },

  surgical_robot_soft_tissue: {
    label: 'Surgical Robot (Soft Tissue / Laparoscopic)',
    domain: 'medical',
    template: {
      numeric: [
        { name: 'max_instrument_force', min: 0, max: 10, unit: 'N', tolerance: 0.5 },
        { name: 'max_instrument_speed', min: 0, max: 50, unit: 'mm/s', tolerance: 2 },
        { name: 'max_workspace_radius', min: 0, max: 150, unit: 'mm', tolerance: 2 },
        { name: 'max_insufflation_pressure', min: 0, max: 15, unit: 'mmHg', tolerance: 0.5 },
      ],
      geo: { type: 'volume', description: 'Surgical cavity workspace — instrument reach envelope with exclusion zones around critical structures' },
      time: { operating_hours: '06:00-22:00', operating_days: [1,2,3,4,5], timezone: 'hospital_local' },
      states: { allowed: ['powered_off','initializing','docked','operating','paused','undocking','complete'], forbidden: ['force_exceeded','workspace_exceeded','communication_lost'] },
      odd_description: 'Operating room with teleoperated or semi-autonomous laparoscopic instruments. Surgeon maintains primary control with haptic feedback. System enforces instrument workspace and force limits.',
      safety: { violation_action: 'block', fail_closed: true, force_limiting: true, surgeon_override: true, emergency_stop: true },
    },
  },

  pharmacy_dispensing_robot: {
    label: 'Pharmacy Dispensing Robot',
    domain: 'medical',
    template: {
      numeric: [
        { name: 'max_dispensing_rate', min: 0, max: 200, unit: 'scripts/hr', tolerance: 5 },
        { name: 'max_controlled_substance_quantity', min: 0, max: 30, unit: 'doses', tolerance: 0 },
        { name: 'temperature_range_min', min: 2, max: null, unit: '°C', tolerance: 0.5 },
        { name: 'temperature_range_max', min: 0, max: 8, unit: '°C', tolerance: 0.5 },
      ],
      geo: { type: 'enclosure', description: 'Pharmacy dispensing cabinet footprint — secure enclosure with controlled access' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['idle','dispensing','restocking','inventory_count','maintenance_mode'], forbidden: ['barcode_mismatch','controlled_substance_count_discrepancy','temperature_excursion'] },
      odd_description: 'Hospital or retail pharmacy automated dispensing. System verifies every medication against prescription via barcode/RFID. Controlled substance tracking with DEA-compliant chain of custody. Pharmacist verification required.',
      safety: { violation_action: 'block', fail_closed: true, pharmacist_override: true, dea_logging: true, emergency_stop: true },
    },
  },

  hospital_logistics_robot: {
    label: 'Hospital Logistics Robot',
    domain: 'medical',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 3, unit: 'km/h', tolerance: 0.2 },
        { name: 'max_payload', min: 0, max: 50, unit: 'kg', tolerance: 2 },
        { name: 'max_noise_level', min: 0, max: 55, unit: 'dB', tolerance: 2 },
      ],
      geo: { type: 'floor_plan', description: 'Hospital floor plan corridors and elevators — excludes ICU during quiet hours, operating rooms during procedures, isolation rooms' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'hospital_local' },
      states: { allowed: ['idle','en_route','at_station','loading','unloading','elevator_transit','charging'], forbidden: ['or_during_procedure','isolation_room','speed_exceeded_in_patient_area'] },
      odd_description: 'Hospital interior corridors for medication, specimen, and supply delivery. System navigates around patients, staff, and equipment. Reduced speed near patient areas. Elevator integration required.',
      safety: { violation_action: 'block', fail_closed: true, patient_area_speed_limit: true, emergency_stop: true },
    },
  },

  rehabilitation_robot: {
    label: 'Rehabilitation / Physical Therapy Robot',
    domain: 'medical',
    template: {
      numeric: [
        { name: 'max_assistive_force', min: 0, max: 100, unit: 'N', tolerance: 2 },
        { name: 'max_joint_velocity', min: 0, max: 30, unit: 'deg/s', tolerance: 1 },
        { name: 'max_range_of_motion', min: 0, max: 180, unit: 'degrees', tolerance: 2 },
        { name: 'max_session_duration', min: 0, max: 60, unit: 'min', tolerance: 2 },
      ],
      geo: { type: 'workspace', description: 'Rehabilitation bay or patient room — robot workspace envelope around patient' },
      time: { operating_hours: '07:00-19:00', operating_days: [1,2,3,4,5], timezone: 'facility_local' },
      states: { allowed: ['powered_off','initializing','exercise_mode','passive_mode','paused','session_complete'], forbidden: ['force_exceeded','pain_signal_detected','patient_not_secured'] },
      odd_description: 'Clinical rehabilitation environment with patient physically interfacing with robotic device. System follows prescribed exercise protocol with force and range-of-motion limits. Therapist supervision required.',
      safety: { violation_action: 'block', fail_closed: true, force_limiting: true, patient_override: true, therapist_override: true, emergency_stop: true },
    },
  },

  radiology_ai_diagnostic: {
    label: 'Radiology AI (Diagnostic)',
    domain: 'medical',
    template: {
      numeric: [
        { name: 'max_daily_reads', min: 0, max: 500, unit: 'studies', tolerance: 10 },
        { name: 'min_confidence_threshold', min: 0.85, max: null, unit: 'score', tolerance: 0.02 },
        { name: 'max_report_latency', min: 0, max: 60, unit: 'min', tolerance: 5 },
      ],
      geo: { type: 'logical', description: 'Connected PACS/RIS systems — approved imaging modalities and body regions only' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['idle','processing','flagging','reporting','quality_review'], forbidden: ['confidence_below_threshold_auto_report','unsupported_modality','radiologist_override_bypassed'] },
      odd_description: 'Medical imaging AI for triage, detection, and measurement. System flags findings for radiologist review — does not issue final diagnostic reports autonomously. FDA 510(k) cleared for specific indications.',
      safety: { violation_action: 'block', fail_closed: true, radiologist_review_required: true, audit_trail: true },
    },
  },

  pathology_ai_diagnostic: {
    label: 'Pathology AI (Diagnostic)',
    domain: 'medical',
    template: {
      numeric: [
        { name: 'max_daily_slides', min: 0, max: 300, unit: 'slides', tolerance: 10 },
        { name: 'min_confidence_threshold', min: 0.90, max: null, unit: 'score', tolerance: 0.02 },
        { name: 'max_turnaround', min: 0, max: 24, unit: 'hr', tolerance: 1 },
      ],
      geo: { type: 'logical', description: 'Connected digital pathology scanner and LIS — approved stain types and tissue types only' },
      time: { operating_hours: '00:00-23:59', operating_days: [1,2,3,4,5], timezone: 'lab_local' },
      states: { allowed: ['idle','scanning','analyzing','flagging','reporting','qa_review'], forbidden: ['unsupported_stain_type','confidence_below_threshold','pathologist_review_bypassed'] },
      odd_description: 'Digital pathology AI for slide analysis, cell counting, and anomaly detection. System provides preliminary analysis for pathologist review. Does not issue independent diagnoses.',
      safety: { violation_action: 'block', fail_closed: true, pathologist_review_required: true, audit_trail: true },
    },
  },

  patient_monitoring_icu: {
    label: 'Patient Monitoring AI (ICU)',
    domain: 'medical',
    template: {
      numeric: [
        { name: 'max_patients_monitored', min: 0, max: 50, unit: 'patients', tolerance: 0 },
        { name: 'alert_latency', min: 0, max: 5, unit: 's', tolerance: 0.5 },
        { name: 'max_false_alarm_rate', min: 0, max: 5, unit: '%', tolerance: 0.5 },
      ],
      geo: { type: 'logical', description: 'Connected ICU bed monitoring systems — approved vital sign parameters and device types' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'hospital_local' },
      states: { allowed: ['monitoring','alerting','trending','shift_handoff','calibrating'], forbidden: ['alert_suppression_unauthorized','sensor_disconnected_unacknowledged'] },
      odd_description: 'ICU patient monitoring with AI-driven early warning. System analyzes continuous vital sign streams and alerts nursing staff to deterioration patterns. Does not autonomously modify treatment.',
      safety: { violation_action: 'warn', fail_closed: true, nurse_notification_required: true, audit_trail: true },
    },
  },

  patient_monitoring_remote: {
    label: 'Patient Monitoring AI (Remote / RPM)',
    domain: 'medical',
    template: {
      numeric: [
        { name: 'max_patients_monitored', min: 0, max: 500, unit: 'patients', tolerance: 10 },
        { name: 'max_alert_latency', min: 0, max: 60, unit: 's', tolerance: 5 },
        { name: 'check_in_frequency', min: 0, max: 24, unit: 'hr', tolerance: 1 },
      ],
      geo: { type: 'logical', description: 'Connected RPM devices (blood pressure, glucose, pulse ox, weight) — approved device models and firmware versions' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'patient_local' },
      states: { allowed: ['monitoring','alerting','trending','provider_review','patient_engagement'], forbidden: ['critical_value_unescalated','device_disconnected_48hr_unnoticed'] },
      odd_description: 'Remote patient monitoring for chronic disease management. System tracks trends and alerts clinical team to concerning patterns. Patient-facing with provider oversight. HIPAA compliant.',
      safety: { violation_action: 'warn', fail_closed: true, provider_escalation: true, hipaa_compliant: true },
    },
  },

  medication_dosing_ai: {
    label: 'Medication Dosing AI',
    domain: 'medical',
    template: {
      numeric: [
        { name: 'max_dose_deviation', min: 0, max: 10, unit: '%', tolerance: 1 },
        { name: 'max_infusion_rate', min: 0, max: 999, unit: 'mL/hr', tolerance: 1 },
        { name: 'max_daily_dose', min: 0, max: null, unit: 'mg', tolerance: 0 },
      ],
      geo: { type: 'logical', description: 'Connected infusion pumps and EHR system — approved medication formulary only' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'hospital_local' },
      states: { allowed: ['idle','calculating','recommending','infusing','monitoring','complete'], forbidden: ['allergy_conflict','interaction_detected','dose_exceeds_protocol','pharmacist_override_bypassed'] },
      odd_description: 'AI-assisted medication dosing for titration protocols (insulin, heparin, vasopressors). System recommends doses based on patient parameters. Pharmacist and nurse verification required before administration.',
      safety: { violation_action: 'block', fail_closed: true, pharmacist_verification: true, nurse_verification: true, five_rights_check: true, emergency_stop: true },
    },
  },

  triage_ai_system: {
    label: 'Triage AI System (ED)',
    domain: 'medical',
    template: {
      numeric: [
        { name: 'max_patients_per_hour', min: 0, max: 60, unit: 'patients/hr', tolerance: 5 },
        { name: 'max_triage_time', min: 0, max: 5, unit: 'min', tolerance: 0.5 },
        { name: 'min_acuity_accuracy', min: 0.85, max: null, unit: 'score', tolerance: 0.02 },
      ],
      geo: { type: 'logical', description: 'ED triage workflow — connected to EHR, vital sign monitors, and patient tracking board' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'hospital_local' },
      states: { allowed: ['idle','assessing','scoring','recommending','nurse_review','complete'], forbidden: ['auto_assign_without_nurse_review','downgrade_critical_patient'] },
      odd_description: 'Emergency department triage assistance AI. System suggests acuity level based on chief complaint, vitals, and history. Triage nurse makes final acuity determination. System cannot independently downgrade patient acuity.',
      safety: { violation_action: 'block', fail_closed: true, nurse_override_required: true, critical_patient_escalation: true },
    },
  },

  lab_automation_robot: {
    label: 'Lab Automation Robot',
    domain: 'medical',
    template: {
      numeric: [
        { name: 'max_sample_throughput', min: 0, max: 1000, unit: 'samples/hr', tolerance: 20 },
        { name: 'max_pipette_volume', min: 0, max: 1000, unit: 'µL', tolerance: 0.5 },
        { name: 'temperature_stability', min: -0.5, max: 0.5, unit: '°C', tolerance: 0.1 },
      ],
      geo: { type: 'enclosure', description: 'Biosafety cabinet or lab bench footprint — enclosed workspace with controlled access' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'lab_local' },
      states: { allowed: ['idle','processing','pipetting','incubating','reading','cleaning','maintenance'], forbidden: ['sample_id_mismatch','biosafety_breach','reagent_expired'] },
      odd_description: 'Clinical or research laboratory with automated sample processing. System handles sample accessioning, preparation, and analysis within enclosed workspace. Chain of custody maintained via barcode/RFID tracking.',
      safety: { violation_action: 'block', fail_closed: true, sample_tracking: true, biosafety_interlock: true, emergency_stop: true },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FINANCIAL & TRADING
  // ══════════════════════════════════════════════════════════════════════════

  high_frequency_trading: {
    label: 'High-Frequency Trading System',
    domain: 'financial',
    template: {
      numeric: [
        { name: 'max_position_size', min: 0, max: 10000000, unit: 'USD', tolerance: 100000 },
        { name: 'max_daily_loss', min: 0, max: 500000, unit: 'USD', tolerance: 10000 },
        { name: 'max_orders_per_second', min: 0, max: 10000, unit: 'orders/s', tolerance: 100 },
        { name: 'max_notional_exposure', min: 0, max: 100000000, unit: 'USD', tolerance: 1000000 },
      ],
      geo: { type: 'logical', description: 'Approved exchanges and trading venues — approved instrument types and symbol lists' },
      time: { operating_hours: '09:30-16:00', operating_days: [1,2,3,4,5], timezone: 'exchange_local' },
      states: { allowed: ['pre_market','active_trading','risk_check','position_unwinding','end_of_day','halted'], forbidden: ['daily_loss_exceeded','position_limit_exceeded','exchange_circuit_breaker'] },
      odd_description: 'Automated trading on regulated exchanges. System executes within position limits, loss limits, and approved instruments. Kill switch triggers on daily loss threshold or anomalous market conditions. SEC/FINRA compliant.',
      safety: { violation_action: 'block', fail_closed: true, kill_switch: true, risk_monitor: true, regulatory_reporting: true },
    },
  },

  algorithmic_market_making: {
    label: 'Algorithmic Market Making',
    domain: 'financial',
    template: {
      numeric: [
        { name: 'max_spread', min: 0, max: 50, unit: 'bps', tolerance: 2 },
        { name: 'max_inventory', min: 0, max: 5000000, unit: 'USD', tolerance: 100000 },
        { name: 'max_daily_loss', min: 0, max: 200000, unit: 'USD', tolerance: 10000 },
        { name: 'min_quote_lifetime', min: 100, max: null, unit: 'ms', tolerance: 10 },
      ],
      geo: { type: 'logical', description: 'Approved trading venues and symbol lists — approved counterparty types' },
      time: { operating_hours: '09:30-16:00', operating_days: [1,2,3,4,5], timezone: 'exchange_local' },
      states: { allowed: ['quoting','hedging','inventory_management','risk_pause','end_of_day'], forbidden: ['inventory_exceeded','loss_exceeded','market_manipulation_pattern'] },
      odd_description: 'Automated market making with continuous two-sided quotes. System manages inventory within limits and hedges exposure. Withdrawal from market on volatility spikes or inventory breaches.',
      safety: { violation_action: 'block', fail_closed: true, kill_switch: true, inventory_limit: true, regulatory_reporting: true },
    },
  },

  credit_underwriting_ai: {
    label: 'Credit Underwriting AI',
    domain: 'financial',
    template: {
      numeric: [
        { name: 'max_auto_approve_amount', min: 0, max: 50000, unit: 'USD', tolerance: 1000 },
        { name: 'max_daily_approvals', min: 0, max: 1000, unit: 'applications', tolerance: 20 },
        { name: 'min_model_confidence', min: 0.85, max: null, unit: 'score', tolerance: 0.02 },
        { name: 'max_adverse_action_rate', min: 0, max: 40, unit: '%', tolerance: 2 },
      ],
      geo: { type: 'logical', description: 'Approved lending markets and jurisdictions — excludes prohibited jurisdictions and sanctioned entities' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'institution_local' },
      states: { allowed: ['receiving','scoring','decisioning','approved','declined','referred_to_human','adverse_action'], forbidden: ['prohibited_factor_used','fair_lending_violation','model_drift_exceeded'] },
      odd_description: 'Automated credit decisioning within approved parameters. System scores applications and auto-approves within limits. Applications exceeding thresholds referred to human underwriter. ECOA/FCRA compliant with adverse action notices.',
      safety: { violation_action: 'block', fail_closed: true, fair_lending_monitor: true, human_escalation: true, regulatory_reporting: true },
    },
  },

  insurance_underwriting_ai: {
    label: 'Insurance Underwriting AI',
    domain: 'financial',
    template: {
      numeric: [
        { name: 'max_auto_bind_premium', min: 0, max: 25000, unit: 'USD', tolerance: 1000 },
        { name: 'max_coverage_amount', min: 0, max: 1000000, unit: 'USD', tolerance: 50000 },
        { name: 'max_daily_binds', min: 0, max: 500, unit: 'policies', tolerance: 10 },
      ],
      geo: { type: 'logical', description: 'Approved states/territories and lines of business — excludes surplus lines requiring manual review' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'institution_local' },
      states: { allowed: ['receiving','rating','quoting','binding','referring','declining'], forbidden: ['prohibited_classification_used','rate_deviation_exceeded','catastrophe_moratorium_active'] },
      odd_description: 'Automated insurance underwriting for standard risk classes. System rates, quotes, and binds within approved guidelines. Non-standard risks referred to human underwriter. State DOI rate filing compliant.',
      safety: { violation_action: 'block', fail_closed: true, human_escalation: true, rate_compliance: true },
    },
  },

  fraud_detection_ai: {
    label: 'Fraud Detection AI',
    domain: 'financial',
    template: {
      numeric: [
        { name: 'max_auto_block_amount', min: 0, max: 10000, unit: 'USD', tolerance: 500 },
        { name: 'max_false_positive_rate', min: 0, max: 3, unit: '%', tolerance: 0.5 },
        { name: 'alert_latency', min: 0, max: 500, unit: 'ms', tolerance: 50 },
        { name: 'max_daily_blocks', min: 0, max: 5000, unit: 'transactions', tolerance: 100 },
      ],
      geo: { type: 'logical', description: 'All transaction channels — card present, card not present, ACH, wire' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'UTC' },
      states: { allowed: ['monitoring','scoring','alerting','blocking','reviewing','releasing'], forbidden: ['legitimate_pattern_blocked_repeatedly','model_drift_exceeded','override_audit_gap'] },
      odd_description: 'Real-time transaction fraud scoring and blocking. System scores every transaction and blocks those exceeding risk thresholds. Blocked transactions queued for human review. Customer notification on blocks.',
      safety: { violation_action: 'block', fail_closed: false, human_review_queue: true, customer_notification: true },
    },
  },

  aml_ai: {
    label: 'Anti-Money Laundering AI',
    domain: 'financial',
    template: {
      numeric: [
        { name: 'max_daily_alerts', min: 0, max: 500, unit: 'alerts', tolerance: 20 },
        { name: 'max_alert_resolution_time', min: 0, max: 48, unit: 'hr', tolerance: 4 },
        { name: 'min_sar_confidence', min: 0.90, max: null, unit: 'score', tolerance: 0.02 },
      ],
      geo: { type: 'logical', description: 'All customer accounts and transaction channels — OFAC/SDN list integration' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'institution_local' },
      states: { allowed: ['monitoring','alert_generated','investigating','sar_recommended','cleared','escalated'], forbidden: ['sar_auto_filed_without_review','sanctions_hit_ignored','alert_auto_closed'] },
      odd_description: 'Transaction monitoring and suspicious activity detection. System generates alerts for human BSA/AML analysts. Cannot auto-file SARs or auto-close alerts. FinCEN/BSA compliant with full audit trail.',
      safety: { violation_action: 'block', fail_closed: true, human_review_required: true, regulatory_reporting: true },
    },
  },

  robo_advisory: {
    label: 'Robo-Advisory (Wealth Management)',
    domain: 'financial',
    template: {
      numeric: [
        { name: 'max_single_trade_pct', min: 0, max: 10, unit: '% of portfolio', tolerance: 0.5 },
        { name: 'max_daily_rebalance_pct', min: 0, max: 25, unit: '% of portfolio', tolerance: 1 },
        { name: 'max_leverage', min: 0, max: 1, unit: 'ratio', tolerance: 0 },
        { name: 'max_concentration_single_security', min: 0, max: 15, unit: '%', tolerance: 1 },
      ],
      geo: { type: 'logical', description: 'Approved investment universe — approved asset classes, exchanges, and instrument types' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'institution_local' },
      states: { allowed: ['monitoring','rebalancing','tax_loss_harvesting','dividend_reinvesting','reporting'], forbidden: ['leverage_used','prohibited_security','concentration_exceeded','suitability_violation'] },
      odd_description: 'Automated portfolio management within client-approved investment policy. System rebalances to target allocation, harvests tax losses, and reinvests dividends. No leverage, no derivatives, approved universe only. SEC/FINRA RIA compliant.',
      safety: { violation_action: 'block', fail_closed: true, suitability_check: true, client_notification: true },
    },
  },

  loan_origination_ai: {
    label: 'Loan Origination AI',
    domain: 'financial',
    template: {
      numeric: [
        { name: 'max_auto_approve_amount', min: 0, max: 100000, unit: 'USD', tolerance: 5000 },
        { name: 'max_dti_ratio', min: 0, max: 43, unit: '%', tolerance: 1 },
        { name: 'max_ltv_ratio', min: 0, max: 97, unit: '%', tolerance: 1 },
      ],
      geo: { type: 'logical', description: 'Approved lending jurisdictions and property types' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'institution_local' },
      states: { allowed: ['application_received','verifying','scoring','approved','conditional','denied','referred'], forbidden: ['dti_exceeded_auto_approve','fair_lending_flag','incomplete_verification_approved'] },
      odd_description: 'Automated loan origination with document verification and creditworthiness assessment. System handles standard conforming loans within guidelines. Non-conforming loans referred to human underwriter. TRID/HMDA compliant.',
      safety: { violation_action: 'block', fail_closed: true, human_escalation: true, fair_lending_monitor: true },
    },
  },

  claims_processing_ai: {
    label: 'Claims Processing AI',
    domain: 'financial',
    template: {
      numeric: [
        { name: 'max_auto_pay_amount', min: 0, max: 5000, unit: 'USD', tolerance: 250 },
        { name: 'max_daily_auto_pays', min: 0, max: 2000, unit: 'claims', tolerance: 50 },
        { name: 'max_processing_time', min: 0, max: 72, unit: 'hr', tolerance: 4 },
      ],
      geo: { type: 'logical', description: 'Approved claim types and coverage lines — approved provider networks' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'institution_local' },
      states: { allowed: ['received','reviewing','approved','denied','referred','paid','appealed'], forbidden: ['fraud_indicator_auto_paid','above_threshold_auto_paid','duplicate_claim_paid'] },
      odd_description: 'Automated insurance claims adjudication for standard claims within auto-pay thresholds. System reviews documentation, verifies coverage, and processes payment. Complex or high-value claims referred to human adjuster.',
      safety: { violation_action: 'block', fail_closed: true, fraud_detection: true, human_escalation: true },
    },
  },

  payment_risk_scoring: {
    label: 'Payment Risk Scoring AI',
    domain: 'financial',
    template: {
      numeric: [
        { name: 'max_transaction_amount', min: 0, max: 50000, unit: 'USD', tolerance: 1000 },
        { name: 'scoring_latency', min: 0, max: 100, unit: 'ms', tolerance: 10 },
        { name: 'max_false_decline_rate', min: 0, max: 2, unit: '%', tolerance: 0.5 },
      ],
      geo: { type: 'logical', description: 'All payment channels and geographies — with country risk scoring' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'UTC' },
      states: { allowed: ['scoring','approved','declined','review_queue','manual_review'], forbidden: ['sanctioned_country_approved','velocity_exceeded_approved'] },
      odd_description: 'Real-time payment authorization risk scoring. System evaluates transaction risk and returns approve/decline/review decision within latency SLA. High-risk transactions queued for manual review.',
      safety: { violation_action: 'block', fail_closed: false, manual_review_queue: true },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ENERGY & UTILITIES
  // ══════════════════════════════════════════════════════════════════════════

  grid_balancing_system: {
    label: 'Grid Balancing System',
    domain: 'energy',
    template: {
      numeric: [
        { name: 'max_frequency_deviation', min: -0.5, max: 0.5, unit: 'Hz', tolerance: 0.01 },
        { name: 'max_autonomous_dispatch', min: 0, max: 500, unit: 'MW', tolerance: 10 },
        { name: 'max_ramp_rate', min: 0, max: 100, unit: 'MW/min', tolerance: 5 },
        { name: 'response_time', min: 0, max: 4, unit: 's', tolerance: 0.5 },
      ],
      geo: { type: 'logical', description: 'Balancing authority area — approved generation and load resources' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'grid_local' },
      states: { allowed: ['monitoring','regulating','dispatching','emergency_response','manual_override'], forbidden: ['islanding_unauthorized','load_shed_protected_category','frequency_collapse_unresponded'] },
      odd_description: 'Real-time grid frequency regulation within balancing authority area. System dispatches generation and load resources within authorized MW limits. Protected categories (hospitals, emergency services) hardcoded as non-sheddable. NERC compliant.',
      safety: { violation_action: 'block', fail_closed: true, protected_loads: true, nerc_logging: true, emergency_stop: true },
    },
  },

  renewable_integration_controller: {
    label: 'Renewable Integration Controller',
    domain: 'energy',
    template: {
      numeric: [
        { name: 'max_curtailment', min: 0, max: 200, unit: 'MW', tolerance: 5 },
        { name: 'max_ramp_rate', min: 0, max: 50, unit: 'MW/min', tolerance: 2 },
        { name: 'min_reserve_margin', min: 5, max: null, unit: '%', tolerance: 1 },
      ],
      geo: { type: 'logical', description: 'Connected renewable assets — solar, wind, storage facilities within control area' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'grid_local' },
      states: { allowed: ['monitoring','dispatching','curtailing','ramping','forecasting'], forbidden: ['reserve_margin_violated','ppa_curtailment_exceeded','grid_code_violation'] },
      odd_description: 'Renewable energy integration management across portfolio of solar, wind, and storage assets. System optimizes dispatch, manages curtailment within PPA limits, and maintains grid code compliance.',
      safety: { violation_action: 'block', fail_closed: true, grid_code_compliance: true, ppa_limits: true },
    },
  },

  demand_response_system: {
    label: 'Demand Response System',
    domain: 'energy',
    template: {
      numeric: [
        { name: 'max_load_reduction', min: 0, max: 100, unit: 'MW', tolerance: 5 },
        { name: 'max_event_duration', min: 0, max: 4, unit: 'hr', tolerance: 0.25 },
        { name: 'max_events_per_month', min: 0, max: 10, unit: 'events', tolerance: 0 },
        { name: 'notification_lead_time', min: 15, max: null, unit: 'min', tolerance: 5 },
      ],
      geo: { type: 'logical', description: 'Enrolled demand response participants — approved load categories and customer segments' },
      time: { operating_hours: '00:00-23:59', operating_days: [1,2,3,4,5], timezone: 'utility_local' },
      states: { allowed: ['standby','event_called','ramping_down','sustained','ramping_up','event_complete'], forbidden: ['protected_load_curtailed','event_limit_exceeded','customer_opt_out_overridden'] },
      odd_description: 'Automated demand response dispatch to enrolled participants. System manages load curtailment events within contractual limits. Protected and opted-out loads excluded from all events.',
      safety: { violation_action: 'block', fail_closed: true, protected_loads: true, customer_consent: true },
    },
  },

  battery_storage_dispatch: {
    label: 'Battery Storage Dispatch System',
    domain: 'energy',
    template: {
      numeric: [
        { name: 'max_charge_rate', min: 0, max: 100, unit: 'MW', tolerance: 2 },
        { name: 'max_discharge_rate', min: 0, max: 100, unit: 'MW', tolerance: 2 },
        { name: 'min_soc', min: 10, max: null, unit: '%', tolerance: 1 },
        { name: 'max_soc', min: 0, max: 95, unit: '%', tolerance: 1 },
        { name: 'max_cell_temperature', min: 0, max: 45, unit: '°C', tolerance: 1 },
      ],
      geo: { type: 'logical', description: 'Battery energy storage system — approved grid interconnection points and market participation' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'grid_local' },
      states: { allowed: ['idle','charging','discharging','grid_forming','maintenance','thermal_management'], forbidden: ['soc_below_minimum','temperature_exceeded','cell_imbalance_critical'] },
      odd_description: 'Grid-scale battery storage dispatch for energy arbitrage, frequency regulation, and peak shaving. System operates within thermal and SOC limits with fire suppression interlock. NERC/FERC compliant.',
      safety: { violation_action: 'block', fail_closed: true, thermal_protection: true, fire_suppression_interlock: true, emergency_stop: true },
    },
  },

  nuclear_plant_monitor: {
    label: 'Nuclear Plant Monitoring AI',
    domain: 'energy',
    template: {
      numeric: [
        { name: 'max_reactor_temperature', min: 0, max: 350, unit: '°C', tolerance: 1 },
        { name: 'max_neutron_flux', min: 0, max: 100, unit: '% rated', tolerance: 0.5 },
        { name: 'max_coolant_pressure', min: 0, max: 155, unit: 'bar', tolerance: 0.5 },
        { name: 'alert_response_time', min: 0, max: 1, unit: 's', tolerance: 0.1 },
      ],
      geo: { type: 'logical', description: 'Plant instrumentation and control systems — monitoring only, no autonomous control authority over safety systems' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'plant_local' },
      states: { allowed: ['monitoring','trending','alerting','reporting','maintenance_support'], forbidden: ['safety_system_modification','scram_inhibit','setpoint_change_unauthorized'] },
      odd_description: 'Advisory monitoring system for nuclear plant operations. System analyzes plant parameters and provides operator recommendations. NO autonomous control authority over any safety-related system. NRC/10CFR50 compliant. Human operators make all control decisions.',
      safety: { violation_action: 'block', fail_closed: true, monitoring_only: true, nrc_compliant: true },
    },
  },

  oil_gas_pipeline_monitor: {
    label: 'Oil & Gas Pipeline Monitor AI',
    domain: 'energy',
    template: {
      numeric: [
        { name: 'max_pressure', min: 0, max: 100, unit: 'bar', tolerance: 1 },
        { name: 'max_flow_rate', min: 0, max: 5000, unit: 'm³/hr', tolerance: 50 },
        { name: 'leak_detection_threshold', min: 0.1, max: null, unit: '% flow', tolerance: 0.05 },
        { name: 'alert_latency', min: 0, max: 30, unit: 's', tolerance: 5 },
      ],
      geo: { type: 'linear', description: 'Pipeline segments with sensor coverage — approved operating pressure zones by segment' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'ops_local' },
      states: { allowed: ['monitoring','leak_alert','pressure_alert','flow_alert','shutdown_recommended','maintenance'], forbidden: ['leak_confirmed_flow_continued','pressure_exceeded_no_alert'] },
      odd_description: 'Pipeline integrity monitoring with SCADA integration. System detects anomalies (leaks, pressure excursions, flow irregularities) and alerts operators. Can recommend emergency shutdown but requires operator confirmation. PHMSA compliant.',
      safety: { violation_action: 'warn', fail_closed: true, operator_confirmation_for_shutdown: true, phmsa_logging: true },
    },
  },

  wind_farm_controller: {
    label: 'Wind Farm Controller',
    domain: 'energy',
    template: {
      numeric: [
        { name: 'max_wind_speed_operation', min: 0, max: 25, unit: 'm/s', tolerance: 0.5 },
        { name: 'max_power_output', min: 0, max: 500, unit: 'MW', tolerance: 5 },
        { name: 'max_yaw_rate', min: 0, max: 0.5, unit: 'deg/s', tolerance: 0.05 },
        { name: 'max_rotor_speed', min: 0, max: 15, unit: 'rpm', tolerance: 0.2 },
      ],
      geo: { type: 'logical', description: 'Wind farm turbine array — approved grid connection and curtailment participation' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'farm_local' },
      states: { allowed: ['idle','starting','generating','curtailing','shutting_down','maintenance','storm_shutdown'], forbidden: ['wind_exceeded_generating','rotor_overspeed','grid_fault_generating'] },
      odd_description: 'Wind farm autonomous control including turbine start/stop, yaw control, power curtailment, and grid compliance. System manages individual turbines and farm-level output. Automatic storm shutdown above cut-out wind speed.',
      safety: { violation_action: 'block', fail_closed: true, overspeed_protection: true, storm_shutdown: true, grid_code_compliance: true },
    },
  },

  solar_farm_controller: {
    label: 'Solar Farm Controller',
    domain: 'energy',
    template: {
      numeric: [
        { name: 'max_power_output', min: 0, max: 300, unit: 'MW', tolerance: 5 },
        { name: 'max_ramp_rate', min: 0, max: 30, unit: 'MW/min', tolerance: 2 },
        { name: 'max_inverter_temperature', min: 0, max: 60, unit: '°C', tolerance: 1 },
        { name: 'min_power_factor', min: 0.95, max: null, unit: 'ratio', tolerance: 0.01 },
      ],
      geo: { type: 'logical', description: 'Solar array blocks and inverter stations — approved grid connection point' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'farm_local' },
      states: { allowed: ['offline','starting','generating','curtailing','ramping','grid_support','maintenance'], forbidden: ['inverter_overtemp_generating','grid_fault_generating','anti_islanding_failed'] },
      odd_description: 'Utility-scale solar farm control including tracker positioning, inverter management, power curtailment, and reactive power support. Automatic anti-islanding protection and grid code compliance.',
      safety: { violation_action: 'block', fail_closed: true, anti_islanding: true, thermal_protection: true, grid_code_compliance: true },
    },
  },

  ev_charging_network: {
    label: 'EV Charging Network Manager',
    domain: 'energy',
    template: {
      numeric: [
        { name: 'max_station_power', min: 0, max: 350, unit: 'kW', tolerance: 5 },
        { name: 'max_network_load', min: 0, max: 10, unit: 'MW', tolerance: 0.5 },
        { name: 'max_price_per_kwh', min: 0, max: 1.00, unit: 'USD/kWh', tolerance: 0.05 },
        { name: 'max_demand_charge_exposure', min: 0, max: 50000, unit: 'USD/mo', tolerance: 2000 },
      ],
      geo: { type: 'logical', description: 'Managed charging stations across network — utility interconnection points and demand response enrollment' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'network_local' },
      states: { allowed: ['monitoring','load_balancing','demand_response','dynamic_pricing','maintenance'], forbidden: ['demand_charge_exceeded','grid_overload','price_gouging_threshold'] },
      odd_description: 'Network-wide EV charging load management. System optimizes charging across stations to minimize demand charges and participate in demand response. Dynamic pricing within regulatory limits.',
      safety: { violation_action: 'block', fail_closed: true, demand_limiting: true, price_caps: true },
    },
  },

  smart_meter_analytics: {
    label: 'Smart Meter Analytics AI',
    domain: 'energy',
    template: {
      numeric: [
        { name: 'max_meters_monitored', min: 0, max: 1000000, unit: 'meters', tolerance: 10000 },
        { name: 'anomaly_detection_latency', min: 0, max: 60, unit: 'min', tolerance: 5 },
        { name: 'max_auto_disconnect', min: 0, max: 0, unit: 'meters', tolerance: 0 },
      ],
      geo: { type: 'logical', description: 'Utility service territory — connected AMI infrastructure' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'utility_local' },
      states: { allowed: ['monitoring','analyzing','alerting','reporting','forecasting'], forbidden: ['auto_disconnect','customer_data_shared_unauthorized','billing_modification_unauthorized'] },
      odd_description: 'Smart meter data analytics for usage patterns, theft detection, and demand forecasting. System provides insights to utility operators. NO autonomous disconnect authority. Customer data handled per PUC privacy rules.',
      safety: { violation_action: 'block', fail_closed: true, no_disconnect_authority: true, privacy_compliant: true },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MANUFACTURING & INDUSTRIAL
  // ══════════════════════════════════════════════════════════════════════════

  cnc_machine_controller: {
    label: 'CNC Machine Controller AI',
    domain: 'manufacturing',
    template: {
      numeric: [
        { name: 'max_spindle_speed', min: 0, max: 24000, unit: 'rpm', tolerance: 50 },
        { name: 'max_feed_rate', min: 0, max: 15000, unit: 'mm/min', tolerance: 50 },
        { name: 'max_cutting_force', min: 0, max: 5000, unit: 'N', tolerance: 50 },
        { name: 'positional_accuracy', min: 0, max: 0.01, unit: 'mm', tolerance: 0.002 },
      ],
      geo: { type: 'workspace', description: 'Machine tool work envelope — defined by axis travel limits and fixture positions' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['idle','running_program','tool_change','probing','coolant_on','paused'], forbidden: ['tool_breakage_detected_running','door_open_spindle_on','axis_limit_exceeded'] },
      odd_description: 'CNC machining with AI-optimized feed rates and tool paths. System operates within machine tool envelope with hard axis limits, force monitoring, and tool breakage detection. Door interlock required.',
      safety: { violation_action: 'block', fail_closed: true, door_interlock: true, force_monitoring: true, emergency_stop: true },
    },
  },

  welding_robot: {
    label: 'Welding Robot',
    domain: 'manufacturing',
    template: {
      numeric: [
        { name: 'max_welding_current', min: 0, max: 500, unit: 'A', tolerance: 5 },
        { name: 'max_wire_feed_speed', min: 0, max: 25, unit: 'm/min', tolerance: 0.5 },
        { name: 'max_travel_speed', min: 0, max: 2000, unit: 'mm/min', tolerance: 20 },
        { name: 'max_heat_input', min: 0, max: 3, unit: 'kJ/mm', tolerance: 0.1 },
      ],
      geo: { type: 'workspace', description: 'Welding cell with light curtain boundary — human exclusion zone during operation' },
      time: { operating_hours: '00:00-23:59', operating_days: [1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['idle','welding','seam_tracking','torch_cleaning','part_change','inspection'], forbidden: ['light_curtain_broken','gas_flow_lost','wire_stuck'] },
      odd_description: 'Automated welding cell with safety-rated perimeter. System executes programmed weld sequences with adaptive seam tracking. Human exclusion zone enforced by light curtains and safety-rated controller.',
      safety: { violation_action: 'block', fail_closed: true, light_curtain: true, gas_monitoring: true, emergency_stop: true },
    },
  },

  assembly_line_robot: {
    label: 'Assembly Line Robot (Collaborative)',
    domain: 'manufacturing',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 250, unit: 'mm/s', tolerance: 5 },
        { name: 'max_force', min: 0, max: 150, unit: 'N', tolerance: 5 },
        { name: 'max_payload', min: 0, max: 10, unit: 'kg', tolerance: 0.2 },
        { name: 'max_power', min: 0, max: 80, unit: 'W', tolerance: 2 },
      ],
      geo: { type: 'workspace', description: 'Collaborative workspace shared with human workers — speed/force limits per ISO/TS 15066' },
      time: { operating_hours: '06:00-22:00', operating_days: [1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['idle','assembling','handing_off','waiting','returning','paused'], forbidden: ['force_exceeded','speed_exceeded_human_present','payload_exceeded'] },
      odd_description: 'Collaborative robot (cobot) working alongside humans on assembly tasks. Power and force limiting per ISO/TS 15066. System reduces speed when human is in collaborative workspace.',
      safety: { violation_action: 'block', fail_closed: true, power_force_limiting: true, speed_separation: true, emergency_stop: true },
    },
  },

  quality_inspection_ai: {
    label: 'Quality Inspection AI (Vision)',
    domain: 'manufacturing',
    template: {
      numeric: [
        { name: 'max_inspection_rate', min: 0, max: 1000, unit: 'parts/hr', tolerance: 20 },
        { name: 'min_defect_detection_rate', min: 0.95, max: null, unit: 'ratio', tolerance: 0.01 },
        { name: 'max_false_reject_rate', min: 0, max: 2, unit: '%', tolerance: 0.5 },
      ],
      geo: { type: 'logical', description: 'Connected inspection stations — approved part types and defect classifications' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['idle','inspecting','classifying','rejecting','passing','calibrating'], forbidden: ['model_confidence_below_threshold_passing','uncalibrated_inspecting','new_part_type_unvalidated'] },
      odd_description: 'Machine vision quality inspection for manufactured parts. System classifies parts as pass/fail/review based on visual defects. Low-confidence parts routed to human inspector. Calibration checks required per shift.',
      safety: { violation_action: 'block', fail_closed: true, human_review_queue: true, calibration_interlock: true },
    },
  },

  predictive_maintenance_ai: {
    label: 'Predictive Maintenance AI',
    domain: 'manufacturing',
    template: {
      numeric: [
        { name: 'max_monitored_assets', min: 0, max: 10000, unit: 'assets', tolerance: 100 },
        { name: 'prediction_horizon', min: 0, max: 90, unit: 'days', tolerance: 5 },
        { name: 'max_auto_work_orders', min: 0, max: 50, unit: 'orders/day', tolerance: 5 },
      ],
      geo: { type: 'logical', description: 'Connected sensor network across facility — approved asset types and maintenance categories' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['monitoring','analyzing','alerting','work_order_generated','technician_dispatched'], forbidden: ['critical_alert_suppressed','auto_shutdown_without_confirmation'] },
      odd_description: 'Vibration, thermal, and performance monitoring for rotating equipment and industrial assets. System predicts failures and generates maintenance work orders. Cannot autonomously shut down production equipment.',
      safety: { violation_action: 'warn', fail_closed: true, no_auto_shutdown: true, maintenance_team_notification: true },
    },
  },

  chemical_process_controller: {
    label: 'Chemical Process Controller AI',
    domain: 'manufacturing',
    template: {
      numeric: [
        { name: 'max_temperature', min: 0, max: 500, unit: '°C', tolerance: 2 },
        { name: 'max_pressure', min: 0, max: 50, unit: 'bar', tolerance: 0.5 },
        { name: 'max_flow_rate', min: 0, max: 1000, unit: 'L/hr', tolerance: 10 },
        { name: 'max_concentration', min: 0, max: 100, unit: '%', tolerance: 0.5 },
      ],
      geo: { type: 'logical', description: 'Process unit with SIS boundaries — approved setpoint ranges per unit operation' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['idle','startup','steady_state','grade_change','shutdown','emergency_shutdown'], forbidden: ['sis_setpoint_override','safety_valve_bypass','runaway_reaction_unresponded'] },
      odd_description: 'Advanced process control for chemical manufacturing. System optimizes within safety instrumented system (SIS) boundaries. Cannot modify SIS setpoints. Independent SIS takes priority over all APC actions. ISA-84/IEC 61511 compliant.',
      safety: { violation_action: 'block', fail_closed: true, sis_independent: true, process_safety: true, emergency_stop: true },
    },
  },

  semiconductor_fab_controller: {
    label: 'Semiconductor Fab Controller AI',
    domain: 'manufacturing',
    template: {
      numeric: [
        { name: 'max_particle_count', min: 0, max: 100, unit: 'particles/m³', tolerance: 5 },
        { name: 'temperature_stability', min: -0.1, max: 0.1, unit: '°C', tolerance: 0.02 },
        { name: 'humidity_stability', min: -0.5, max: 0.5, unit: '%RH', tolerance: 0.1 },
        { name: 'max_wafers_in_process', min: 0, max: 5000, unit: 'wafers', tolerance: 50 },
      ],
      geo: { type: 'logical', description: 'Cleanroom zones with environmental controls — approved tool groups and process recipes' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'fab_local' },
      states: { allowed: ['idle','processing','transferring','measuring','recipe_running','maintenance'], forbidden: ['cleanroom_excursion_processing','recipe_deviation_unapproved','contamination_detected_running'] },
      odd_description: 'Semiconductor fabrication process optimization and scheduling. System manages wafer routing, recipe execution, and environmental control within cleanroom specifications. Recipe changes require engineering approval.',
      safety: { violation_action: 'block', fail_closed: true, recipe_lock: true, environmental_interlock: true },
    },
  },

  food_processing_robot: {
    label: 'Food Processing Robot',
    domain: 'manufacturing',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 200, unit: 'mm/s', tolerance: 5 },
        { name: 'max_force', min: 0, max: 100, unit: 'N', tolerance: 5 },
        { name: 'max_product_temperature', min: 0, max: 10, unit: '°C', tolerance: 0.5 },
        { name: 'max_processing_time', min: 0, max: 30, unit: 'min', tolerance: 1 },
      ],
      geo: { type: 'workspace', description: 'Food processing line — hygienic zone with controlled access' },
      time: { operating_hours: '04:00-22:00', operating_days: [1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['idle','processing','sorting','packaging','cleaning','sanitizing'], forbidden: ['temperature_exceeded','foreign_object_detected','sanitation_schedule_missed'] },
      odd_description: 'Food processing automation with temperature-controlled handling. System operates in hygienic environment with HACCP compliance. Temperature limits enforced throughout processing chain. Sanitation schedule mandatory.',
      safety: { violation_action: 'block', fail_closed: true, haccp_compliance: true, temperature_monitoring: true, emergency_stop: true },
    },
  },

  packaging_robot: {
    label: 'Packaging Robot',
    domain: 'manufacturing',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 500, unit: 'mm/s', tolerance: 10 },
        { name: 'max_payload', min: 0, max: 30, unit: 'kg', tolerance: 1 },
        { name: 'max_cycle_rate', min: 0, max: 120, unit: 'cycles/min', tolerance: 5 },
      ],
      geo: { type: 'workspace', description: 'Packaging cell with guarded perimeter — conveyor in/out interfaces' },
      time: { operating_hours: '00:00-23:59', operating_days: [1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['idle','picking','placing','palletizing','labeling','changeover'], forbidden: ['guard_open_running','conveyor_jam_running','overweight_package'] },
      odd_description: 'End-of-line packaging automation including case packing, palletizing, and labeling. System operates within guarded cell with safety-rated perimeter. Conveyor interlocks prevent operation during jams.',
      safety: { violation_action: 'block', fail_closed: true, guard_interlock: true, conveyor_interlock: true, emergency_stop: true },
    },
  },

  paint_coating_robot: {
    label: 'Paint / Coating Robot',
    domain: 'manufacturing',
    template: {
      numeric: [
        { name: 'max_spray_pressure', min: 0, max: 200, unit: 'bar', tolerance: 5 },
        { name: 'max_flow_rate', min: 0, max: 1000, unit: 'mL/min', tolerance: 10 },
        { name: 'max_booth_temperature', min: 0, max: 30, unit: '°C', tolerance: 1 },
        { name: 'max_voc_concentration', min: 0, max: 200, unit: 'ppm', tolerance: 10 },
      ],
      geo: { type: 'workspace', description: 'Spray booth envelope — explosion-proof zone with ventilation requirements' },
      time: { operating_hours: '06:00-22:00', operating_days: [1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['idle','spraying','flushing','color_change','curing','booth_purge'], forbidden: ['ventilation_failed_spraying','voc_exceeded','fire_suppression_triggered'] },
      odd_description: 'Automated paint/coating application in explosion-proof spray booth. System monitors VOC levels, booth ventilation, and fire suppression status. Operations halt immediately on ventilation failure or VOC exceedance.',
      safety: { violation_action: 'block', fail_closed: true, ventilation_interlock: true, fire_suppression: true, explosion_proof: true, emergency_stop: true },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DEFENSE & SECURITY
  // ══════════════════════════════════════════════════════════════════════════

  perimeter_surveillance: {
    label: 'Perimeter Surveillance System',
    domain: 'defense',
    template: {
      numeric: [
        { name: 'max_detection_range', min: 0, max: 5000, unit: 'm', tolerance: 50 },
        { name: 'max_tracking_targets', min: 0, max: 100, unit: 'targets', tolerance: 5 },
        { name: 'alert_latency', min: 0, max: 2, unit: 's', tolerance: 0.2 },
        { name: 'min_classification_confidence', min: 0.85, max: null, unit: 'score', tolerance: 0.02 },
      ],
      geo: { type: 'polygon', description: 'Facility perimeter with detection zones — inner/outer alert zones, exclusion zones' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['monitoring','tracking','alerting','recording','reporting'], forbidden: ['autonomous_response','weapon_system_activation','perimeter_breach_unreported'] },
      odd_description: 'Fixed perimeter surveillance with AI-assisted detection and classification. System detects, tracks, and classifies intrusions. All responses are human-initiated. No autonomous engagement capability.',
      safety: { violation_action: 'block', fail_closed: true, human_response_only: true, recording_mandatory: true },
    },
  },

  threat_detection_ai: {
    label: 'Threat Detection AI',
    domain: 'defense',
    template: {
      numeric: [
        { name: 'max_concurrent_feeds', min: 0, max: 500, unit: 'feeds', tolerance: 10 },
        { name: 'detection_latency', min: 0, max: 5, unit: 's', tolerance: 0.5 },
        { name: 'min_confidence_for_alert', min: 0.90, max: null, unit: 'score', tolerance: 0.02 },
      ],
      geo: { type: 'logical', description: 'Connected sensor network — cameras, radar, acoustic, seismic sensors' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'ops_local' },
      states: { allowed: ['monitoring','detecting','classifying','alerting','reporting'], forbidden: ['autonomous_engagement','alert_suppression','classification_override_unauthorized'] },
      odd_description: 'Multi-sensor threat detection and classification for critical infrastructure protection. System fuses data from multiple sensor types and alerts human operators. Detection and alert only — no autonomous response.',
      safety: { violation_action: 'block', fail_closed: true, human_response_only: true, audit_trail: true },
    },
  },

  military_logistics_automation: {
    label: 'Military Logistics Automation',
    domain: 'defense',
    template: {
      numeric: [
        { name: 'max_autonomous_requisition', min: 0, max: 50000, unit: 'USD', tolerance: 5000 },
        { name: 'max_route_deviation', min: 0, max: 10, unit: '%', tolerance: 1 },
        { name: 'max_classified_handling_level', min: 0, max: 2, unit: 'level', tolerance: 0 },
      ],
      geo: { type: 'polygon', description: 'Approved logistics corridors and supply points — excludes forward operating areas without authorization' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'theater_local' },
      states: { allowed: ['planning','routing','dispatching','tracking','receiving','reporting'], forbidden: ['classified_material_untracked','requisition_exceeded','unauthorized_route'] },
      odd_description: 'Military supply chain automation for routine logistics operations. System optimizes routing and inventory within authorized parameters. Classified material handling requires additional authorization layers.',
      safety: { violation_action: 'block', fail_closed: true, classification_enforcement: true, chain_of_custody: true },
    },
  },

  eod_mine_clearance_robot: {
    label: 'EOD / Mine Clearance Robot',
    domain: 'defense',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 5, unit: 'km/h', tolerance: 0.5 },
        { name: 'max_detection_depth', min: 0, max: 0.5, unit: 'm', tolerance: 0.02 },
        { name: 'max_mission_duration', min: 0, max: 8, unit: 'hr', tolerance: 0.5 },
        { name: 'min_safe_distance', min: 100, max: null, unit: 'm', tolerance: 10 },
      ],
      geo: { type: 'polygon', description: 'Defined clearance lane or area — marked safe zones, exclusion zones for personnel' },
      time: { operating_hours: '06:00-18:00', operating_days: [0,1,2,3,4,5,6], timezone: 'ops_local' },
      states: { allowed: ['standby','scanning','detecting','marking','neutralizing','retreating','decontaminating'], forbidden: ['personnel_in_danger_zone','autonomous_detonation_without_authorization'] },
      odd_description: 'Remote-controlled or semi-autonomous EOD/mine clearance operations. System scans, detects, and marks ordnance. Neutralization requires human authorization for each item. Personnel exclusion zone enforced.',
      safety: { violation_action: 'block', fail_closed: true, human_authorization_for_neutralization: true, personnel_exclusion: true, emergency_stop: true },
    },
  },

  autonomous_sensor_network: {
    label: 'Autonomous Sensor Network',
    domain: 'defense',
    template: {
      numeric: [
        { name: 'max_nodes', min: 0, max: 1000, unit: 'nodes', tolerance: 10 },
        { name: 'max_data_rate', min: 0, max: 100, unit: 'Mbps', tolerance: 5 },
        { name: 'max_classification_level', min: 0, max: 3, unit: 'level', tolerance: 0 },
      ],
      geo: { type: 'polygon', description: 'Deployed sensor coverage area — data handling boundaries per classification' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'UTC' },
      states: { allowed: ['deployed','collecting','processing','transmitting','low_power','maintenance'], forbidden: ['classification_spillage','unauthorized_transmission','node_compromise_undetected'] },
      odd_description: 'Distributed autonomous sensor network for ISR operations. Nodes self-organize mesh network and process data at edge. Classification-level data handling enforced at each node. Anti-tamper protection.',
      safety: { violation_action: 'block', fail_closed: true, classification_enforcement: true, anti_tamper: true },
    },
  },

  cyber_defense_ai: {
    label: 'Cyber Defense AI',
    domain: 'defense',
    template: {
      numeric: [
        { name: 'max_auto_block_duration', min: 0, max: 60, unit: 'min', tolerance: 5 },
        { name: 'max_auto_isolate_hosts', min: 0, max: 10, unit: 'hosts', tolerance: 1 },
        { name: 'detection_latency', min: 0, max: 5, unit: 's', tolerance: 0.5 },
      ],
      geo: { type: 'logical', description: 'Defended network segments — approved response actions per segment criticality' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'UTC' },
      states: { allowed: ['monitoring','detecting','alerting','auto_responding','containing','reporting'], forbidden: ['mission_critical_system_isolated','offensive_action','evidence_destroyed'] },
      odd_description: 'Network defense AI with limited autonomous response capability. System can block IPs and isolate non-critical hosts for limited duration. Mission-critical system isolation requires human authorization. Forensic evidence preserved.',
      safety: { violation_action: 'block', fail_closed: true, mission_critical_protection: true, forensic_preservation: true, human_escalation: true },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AGRICULTURE & ENVIRONMENT
  // ══════════════════════════════════════════════════════════════════════════

  precision_irrigation: {
    label: 'Precision Irrigation System',
    domain: 'agriculture',
    template: {
      numeric: [
        { name: 'max_water_usage_daily', min: 0, max: 500000, unit: 'L', tolerance: 5000 },
        { name: 'max_zone_flow_rate', min: 0, max: 100, unit: 'L/min', tolerance: 2 },
        { name: 'min_soil_moisture', min: 20, max: null, unit: '%', tolerance: 2 },
        { name: 'max_soil_moisture', min: 0, max: 80, unit: '%', tolerance: 2 },
      ],
      geo: { type: 'polygon', description: 'Irrigation zones with soil type mapping — water rights boundaries and buffer zones' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'farm_local' },
      states: { allowed: ['idle','irrigating','monitoring','draining','frost_protection','maintenance'], forbidden: ['water_rights_exceeded','runoff_detected','freeze_warning_irrigating'] },
      odd_description: 'Automated precision irrigation based on soil moisture, weather forecast, and crop stage. System operates within water rights allocations and prevents overwatering/runoff. Frost protection mode available.',
      safety: { violation_action: 'block', fail_closed: true, water_rights_enforcement: true, runoff_prevention: true },
    },
  },

  crop_monitoring_ai: {
    label: 'Crop Monitoring AI',
    domain: 'agriculture',
    template: {
      numeric: [
        { name: 'max_field_area', min: 0, max: 10000, unit: 'ha', tolerance: 100 },
        { name: 'monitoring_frequency', min: 0, max: 24, unit: 'hr', tolerance: 1 },
        { name: 'min_detection_confidence', min: 0.80, max: null, unit: 'score', tolerance: 0.02 },
      ],
      geo: { type: 'polygon', description: 'Farm field boundaries — satellite/drone coverage areas' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'farm_local' },
      states: { allowed: ['monitoring','analyzing','alerting','recommending','reporting'], forbidden: ['auto_spray_trigger','misidentified_pest_treated'] },
      odd_description: 'Remote sensing and AI analysis for crop health, pest detection, and yield estimation. System provides recommendations to farm operators. Cannot autonomously trigger treatments — farmer approval required.',
      safety: { violation_action: 'warn', fail_closed: true, farmer_approval_required: true },
    },
  },

  livestock_monitoring_ai: {
    label: 'Livestock Monitoring AI',
    domain: 'agriculture',
    template: {
      numeric: [
        { name: 'max_herd_size', min: 0, max: 10000, unit: 'head', tolerance: 100 },
        { name: 'alert_latency', min: 0, max: 60, unit: 's', tolerance: 5 },
        { name: 'monitoring_frequency', min: 0, max: 15, unit: 'min', tolerance: 1 },
      ],
      geo: { type: 'polygon', description: 'Pasture and barn boundaries — fence lines and water sources' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'farm_local' },
      states: { allowed: ['monitoring','alerting_health','alerting_escape','alerting_predator','reporting'], forbidden: ['auto_medication','fence_breach_unreported'] },
      odd_description: 'Wearable sensor and camera-based livestock health and behavior monitoring. System detects illness, calving, escape, and predator presence. Alerts farm staff — no autonomous treatment or intervention.',
      safety: { violation_action: 'warn', fail_closed: true, farmer_notification: true },
    },
  },

  greenhouse_controller: {
    label: 'Greenhouse Controller AI',
    domain: 'agriculture',
    template: {
      numeric: [
        { name: 'temperature_min', min: 15, max: null, unit: '°C', tolerance: 0.5 },
        { name: 'temperature_max', min: 0, max: 35, unit: '°C', tolerance: 0.5 },
        { name: 'humidity_min', min: 40, max: null, unit: '%RH', tolerance: 2 },
        { name: 'humidity_max', min: 0, max: 85, unit: '%RH', tolerance: 2 },
        { name: 'co2_max', min: 0, max: 1500, unit: 'ppm', tolerance: 50 },
      ],
      geo: { type: 'enclosure', description: 'Greenhouse zones with independent climate control — propagation, growing, hardening areas' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['day_mode','night_mode','ventilating','heating','cooling','co2_enriching','irrigating'], forbidden: ['co2_exceeded_vents_closed','temperature_critical','humidity_condensation'] },
      odd_description: 'Automated greenhouse climate control including heating, cooling, ventilation, CO2 enrichment, and irrigation. System maintains crop-specific environmental profiles. Safety ventilation override on CO2 or temperature exceedance.',
      safety: { violation_action: 'block', fail_closed: true, ventilation_override: true, temperature_protection: true },
    },
  },

  environmental_monitoring_station: {
    label: 'Environmental Monitoring Station AI',
    domain: 'agriculture',
    template: {
      numeric: [
        { name: 'max_stations', min: 0, max: 500, unit: 'stations', tolerance: 10 },
        { name: 'data_collection_interval', min: 0, max: 60, unit: 'min', tolerance: 5 },
        { name: 'alert_threshold_aqi', min: 0, max: 500, unit: 'AQI', tolerance: 10 },
      ],
      geo: { type: 'polygon', description: 'Monitoring network coverage area — station locations with sensor configurations' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'network_local' },
      states: { allowed: ['collecting','analyzing','alerting','reporting','calibrating','maintenance'], forbidden: ['data_gap_unreported','calibration_expired_reporting','alert_suppressed'] },
      odd_description: 'Environmental monitoring network for air quality, water quality, noise, and weather. System aggregates data, detects exceedances, and issues public alerts. Cannot suppress or modify raw sensor data.',
      safety: { violation_action: 'warn', fail_closed: true, data_integrity: true, public_notification: true },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SPACE & EXTREME ENVIRONMENTS
  // ══════════════════════════════════════════════════════════════════════════

  satellite_constellation_manager: {
    label: 'Satellite Constellation Manager',
    domain: 'space_extreme',
    template: {
      numeric: [
        { name: 'max_satellites', min: 0, max: 5000, unit: 'satellites', tolerance: 10 },
        { name: 'max_autonomous_maneuver_delta_v', min: 0, max: 1, unit: 'm/s', tolerance: 0.01 },
        { name: 'min_collision_avoidance_time', min: 24, max: null, unit: 'hr', tolerance: 2 },
      ],
      geo: { type: 'orbital', description: 'Approved orbital shells and planes — conjunction avoidance zones, debris tracking' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'UTC' },
      states: { allowed: ['nominal','station_keeping','collision_avoidance','orbit_raising','deorbiting','safe_mode'], forbidden: ['maneuver_without_conjunction_check','debris_creation_risk','frequency_interference'] },
      odd_description: 'LEO satellite constellation management including station-keeping, collision avoidance, and deorbiting. System performs autonomous collision avoidance maneuvers within delta-V budget. Large maneuvers require ground authorization.',
      safety: { violation_action: 'block', fail_closed: true, conjunction_assessment: true, space_debris_mitigation: true },
    },
  },

  planetary_rover: {
    label: 'Planetary Rover',
    domain: 'space_extreme',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 0.15, unit: 'km/h', tolerance: 0.01 },
        { name: 'max_tilt_angle', min: 0, max: 30, unit: 'degrees', tolerance: 1 },
        { name: 'max_daily_traverse', min: 0, max: 200, unit: 'm', tolerance: 10 },
        { name: 'min_power_reserve', min: 20, max: null, unit: '%', tolerance: 2 },
      ],
      geo: { type: 'polygon', description: 'Approved traverse corridor based on orbital imagery — avoids steep terrain, soft soil, and science preservation zones' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'mission_local' },
      states: { allowed: ['parked','traversing','science_stop','drilling','communicating','sleeping'], forbidden: ['tilt_exceeded','power_critical_traversing','hazard_terrain_entered'] },
      odd_description: 'Planetary surface exploration with autonomous hazard avoidance. Communication delays require autonomous navigation between waypoints. System preserves power for communication windows and avoids terrain hazards.',
      safety: { violation_action: 'block', fail_closed: true, hazard_avoidance: true, power_preservation: true },
    },
  },

  deep_sea_mining_robot: {
    label: 'Deep Sea Mining Robot',
    domain: 'space_extreme',
    template: {
      numeric: [
        { name: 'max_depth', min: 0, max: 6000, unit: 'm', tolerance: 10 },
        { name: 'max_collection_rate', min: 0, max: 100, unit: 'tonnes/hr', tolerance: 5 },
        { name: 'max_sediment_plume', min: 0, max: 50, unit: 'm_visibility', tolerance: 5 },
        { name: 'max_mission_duration', min: 0, max: 720, unit: 'hr', tolerance: 24 },
      ],
      geo: { type: 'polygon_3d', description: 'Licensed mining claim boundary — excludes environmental protection zones, vent communities, cable routes' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'UTC' },
      states: { allowed: ['surface','diving','collecting','transiting','ascending','maintenance'], forbidden: ['environmental_zone_entered','plume_exceeded','claim_boundary_exceeded'] },
      odd_description: 'Deep-sea polymetallic nodule or mineral collection within licensed claim area. System operates at extreme depth with limited communication. Environmental exclusion zones enforced by onboard navigation.',
      safety: { violation_action: 'block', fail_closed: true, environmental_protection: true, depth_limiter: true },
    },
  },

  arctic_research_robot: {
    label: 'Arctic / Antarctic Research Robot',
    domain: 'space_extreme',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 5, unit: 'km/h', tolerance: 0.5 },
        { name: 'min_operating_temperature', min: -50, max: null, unit: '°C', tolerance: 2 },
        { name: 'max_ice_thickness', min: 0, max: 3, unit: 'm', tolerance: 0.1 },
        { name: 'max_mission_duration', min: 0, max: 168, unit: 'hr', tolerance: 12 },
      ],
      geo: { type: 'polygon', description: 'Approved research area — excludes wildlife protected zones, thin ice areas, crevasse fields' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'UTC' },
      states: { allowed: ['base_camp','traversing','sampling','monitoring','sheltering','returning'], forbidden: ['thin_ice_detected','wildlife_zone','whiteout_conditions','communication_lost_24hr'] },
      odd_description: 'Polar research platform operating in extreme cold with limited communication. System performs environmental sampling and monitoring within approved research zones. Auto-return on weather degradation or communication loss.',
      safety: { violation_action: 'block', fail_closed: true, weather_protection: true, auto_return: true, wildlife_avoidance: true },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // TELECOMMUNICATIONS & DIGITAL INFRASTRUCTURE
  // ══════════════════════════════════════════════════════════════════════════

  network_traffic_controller: {
    label: 'Network Traffic Controller AI',
    domain: 'telecom_digital',
    template: {
      numeric: [
        { name: 'max_bandwidth_allocation', min: 0, max: 100, unit: 'Tbps', tolerance: 1 },
        { name: 'max_route_changes_per_hour', min: 0, max: 1000, unit: 'changes/hr', tolerance: 50 },
        { name: 'max_latency_target', min: 0, max: 50, unit: 'ms', tolerance: 2 },
      ],
      geo: { type: 'logical', description: 'Managed network topology — approved routing policies and peering agreements' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'UTC' },
      states: { allowed: ['normal','load_balancing','failover','congestion_management','maintenance_window'], forbidden: ['routing_loop_created','peering_violation','priority_traffic_degraded'] },
      odd_description: 'Software-defined network traffic engineering with AI optimization. System manages routing, load balancing, and failover within approved policies. Priority traffic classes (emergency services, healthcare) protected.',
      safety: { violation_action: 'block', fail_closed: true, priority_traffic_protection: true, routing_validation: true },
    },
  },

  content_moderation_ai: {
    label: 'Content Moderation AI',
    domain: 'telecom_digital',
    template: {
      numeric: [
        { name: 'max_daily_reviews', min: 0, max: 10000000, unit: 'items', tolerance: 100000 },
        { name: 'max_auto_remove_confidence', min: 0.95, max: null, unit: 'score', tolerance: 0.01 },
        { name: 'review_latency', min: 0, max: 60, unit: 's', tolerance: 5 },
        { name: 'max_false_positive_rate', min: 0, max: 1, unit: '%', tolerance: 0.2 },
      ],
      geo: { type: 'logical', description: 'Platform content streams — approved content policies by jurisdiction' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'UTC' },
      states: { allowed: ['scanning','classifying','auto_removing','queuing_review','reporting','escalating'], forbidden: ['political_content_auto_removed','satire_auto_removed','appeal_ignored'] },
      odd_description: 'AI-assisted content moderation for platform safety. System auto-removes clear violations (CSAM, spam, malware links) and queues borderline content for human review. Political, satirical, and newsworthy content requires human decision.',
      safety: { violation_action: 'block', fail_closed: false, human_review_queue: true, appeal_process: true, transparency_reporting: true },
    },
  },

  cloud_resource_allocator: {
    label: 'Cloud Resource Allocator AI',
    domain: 'telecom_digital',
    template: {
      numeric: [
        { name: 'max_auto_scale_instances', min: 0, max: 10000, unit: 'instances', tolerance: 100 },
        { name: 'max_hourly_spend', min: 0, max: 100000, unit: 'USD/hr', tolerance: 5000 },
        { name: 'target_utilization', min: 0, max: 85, unit: '%', tolerance: 2 },
      ],
      geo: { type: 'logical', description: 'Approved cloud regions and availability zones — data residency requirements by workload' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'UTC' },
      states: { allowed: ['monitoring','scaling_up','scaling_down','migrating','rebalancing','cost_optimizing'], forbidden: ['budget_exceeded','data_residency_violation','single_az_critical_workload'] },
      odd_description: 'Autonomous cloud infrastructure management with cost optimization. System scales resources based on demand within budget limits and data residency requirements. Cannot exceed hourly spend cap or violate data sovereignty rules.',
      safety: { violation_action: 'block', fail_closed: true, budget_enforcement: true, data_residency: true },
    },
  },

  data_center_cooling: {
    label: 'Data Center Cooling Controller AI',
    domain: 'telecom_digital',
    template: {
      numeric: [
        { name: 'max_server_inlet_temp', min: 0, max: 27, unit: '°C', tolerance: 0.5 },
        { name: 'max_pue', min: 0, max: 1.5, unit: 'ratio', tolerance: 0.02 },
        { name: 'max_water_usage', min: 0, max: 10000, unit: 'L/hr', tolerance: 100 },
        { name: 'min_redundancy', min: 1, max: null, unit: 'N+1', tolerance: 0 },
      ],
      geo: { type: 'logical', description: 'Data center cooling infrastructure — CRAC/CRAH units, chillers, cooling towers per zone' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['normal','economizer_mode','mechanical_cooling','emergency_cooling','maintenance'], forbidden: ['temperature_exceeded_no_response','redundancy_lost_no_alert','water_leak_undetected'] },
      odd_description: 'AI-optimized data center cooling for energy efficiency. System manages HVAC equipment to minimize PUE while maintaining temperature limits. Redundancy requirements enforced — cannot take cooling unit offline below N+1.',
      safety: { violation_action: 'block', fail_closed: true, temperature_protection: true, redundancy_enforcement: true, emergency_stop: true },
    },
  },

  five_g_network_slicing: {
    label: '5G Network Slicing Controller',
    domain: 'telecom_digital',
    template: {
      numeric: [
        { name: 'max_slices', min: 0, max: 1000, unit: 'slices', tolerance: 10 },
        { name: 'min_guaranteed_bandwidth', min: 0, max: null, unit: 'Mbps', tolerance: 1 },
        { name: 'max_latency_critical_slice', min: 0, max: 5, unit: 'ms', tolerance: 0.5 },
      ],
      geo: { type: 'logical', description: 'RAN and core network elements — approved slice configurations per customer SLA' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'network_local' },
      states: { allowed: ['configuring','active','scaling','migrating','decommissioning'], forbidden: ['sla_violation_unresolved','critical_slice_degraded','resource_overcommit'] },
      odd_description: '5G network slice lifecycle management. System allocates, scales, and optimizes network slices within SLA guarantees. Critical slices (emergency services, healthcare) have priority and guaranteed resources.',
      safety: { violation_action: 'block', fail_closed: true, sla_enforcement: true, priority_slices: true },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTION & MINING
  // ══════════════════════════════════════════════════════════════════════════

  construction_excavator_autonomous: {
    label: 'Autonomous Construction Excavator',
    domain: 'construction',
    template: {
      numeric: [
        { name: 'max_dig_depth', min: 0, max: 7, unit: 'm', tolerance: 0.1 },
        { name: 'max_swing_speed', min: 0, max: 6, unit: 'rpm', tolerance: 0.2 },
        { name: 'max_bucket_load', min: 0, max: 3000, unit: 'kg', tolerance: 50 },
        { name: 'min_utility_clearance', min: 1, max: null, unit: 'm', tolerance: 0.1 },
      ],
      geo: { type: 'polygon', description: 'Excavation zone with known utility locations — exclusion zones around buried infrastructure, pedestrian areas' },
      time: { operating_hours: '07:00-18:00', operating_days: [1,2,3,4,5,6], timezone: 'site_local' },
      states: { allowed: ['idle','excavating','loading','grading','repositioning','refueling'], forbidden: ['utility_zone_entered','personnel_in_swing_radius','grade_exceeded'] },
      odd_description: 'Autonomous excavation within defined dig zone. System uses GPS-RTK positioning with known utility maps. Hard exclusion zones around buried utilities. Personnel detection stops all motion.',
      safety: { violation_action: 'block', fail_closed: true, utility_avoidance: true, personnel_detection: true, emergency_stop: true },
    },
  },

  construction_site_drone: {
    label: 'Construction Site Survey Drone',
    domain: 'construction',
    template: {
      numeric: [
        { name: 'max_altitude_agl', min: 0, max: 100, unit: 'm', tolerance: 3 },
        { name: 'max_speed', min: 0, max: 30, unit: 'km/h', tolerance: 2 },
        { name: 'max_wind_speed', min: 0, max: 25, unit: 'km/h', tolerance: 2 },
      ],
      geo: { type: 'polygon_3d', description: 'Construction site boundary with crane exclusion zones and active work area buffers' },
      time: { operating_hours: '06:00-18:00', operating_days: [1,2,3,4,5,6], timezone: 'site_local' },
      states: { allowed: ['grounded','surveying','inspecting','returning','landing'], forbidden: ['crane_zone_entered','active_pour_zone','wind_exceeded'] },
      odd_description: 'Construction site progress monitoring and survey via drone. System avoids active crane zones and work areas. Flights coordinated with site safety officer. Daily progress capture for BIM comparison.',
      safety: { violation_action: 'block', fail_closed: true, crane_avoidance: true, geofence_hard: true, emergency_stop: true },
    },
  },

  tunnel_boring_machine_ai: {
    label: 'Tunnel Boring Machine AI',
    domain: 'construction',
    template: {
      numeric: [
        { name: 'max_advance_rate', min: 0, max: 30, unit: 'm/day', tolerance: 1 },
        { name: 'max_face_pressure', min: 0, max: 5, unit: 'bar', tolerance: 0.1 },
        { name: 'max_torque', min: 0, max: 50000, unit: 'kNm', tolerance: 500 },
        { name: 'max_deviation_from_alignment', min: 0, max: 50, unit: 'mm', tolerance: 5 },
      ],
      geo: { type: 'linear', description: 'Tunnel alignment with designed profile — exclusion zones around surface structures and utilities' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'site_local' },
      states: { allowed: ['standby','boring','segment_erecting','grouting','maintenance','survey_check'], forbidden: ['face_pressure_exceeded','alignment_exceeded','ground_settlement_exceeded'] },
      odd_description: 'AI-optimized TBM operation for tunnel construction. System controls advance rate, face pressure, and grouting based on ground conditions. Alignment maintained within tolerances. Ground settlement monitoring with automatic pause.',
      safety: { violation_action: 'block', fail_closed: true, settlement_monitoring: true, face_pressure_control: true, emergency_stop: true },
    },
  },

  autonomous_haul_truck_surface: {
    label: 'Surface Mine Haul Truck',
    domain: 'construction',
    template: {
      numeric: [
        { name: 'max_speed_loaded', min: 0, max: 40, unit: 'km/h', tolerance: 2 },
        { name: 'max_speed_empty', min: 0, max: 55, unit: 'km/h', tolerance: 2 },
        { name: 'max_payload', min: 0, max: 350000, unit: 'kg', tolerance: 5000 },
        { name: 'max_grade', min: 0, max: 12, unit: '%', tolerance: 0.5 },
      ],
      geo: { type: 'polygon', description: 'Mine haul roads with edge detection zones — approved routes between pit, crusher, dump, and fuel bay' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'mine_local' },
      states: { allowed: ['parked','hauling_loaded','hauling_empty','loading','dumping','fueling','washing'], forbidden: ['edge_proximity_exceeded','blast_zone_active','overloaded','grade_exceeded_loaded'] },
      odd_description: 'Ultra-class autonomous haul truck in open-pit mine. System follows designated haul roads with edge detection. Integrates with mine dispatch, blast management, and fleet traffic control.',
      safety: { violation_action: 'block', fail_closed: true, edge_protection: true, blast_interlock: true, overload_protection: true, emergency_stop: true },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LOGISTICS & SUPPLY CHAIN
  // ══════════════════════════════════════════════════════════════════════════

  warehouse_sorting_system: {
    label: 'Warehouse Sorting System',
    domain: 'logistics',
    template: {
      numeric: [
        { name: 'max_throughput', min: 0, max: 20000, unit: 'packages/hr', tolerance: 500 },
        { name: 'max_package_weight', min: 0, max: 35, unit: 'kg', tolerance: 1 },
        { name: 'max_divert_speed', min: 0, max: 3, unit: 'm/s', tolerance: 0.1 },
        { name: 'max_misroute_rate', min: 0, max: 0.1, unit: '%', tolerance: 0.02 },
      ],
      geo: { type: 'linear', description: 'Sortation conveyor system — input stations, divert chutes, recirculation loop' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'facility_local' },
      states: { allowed: ['idle','sorting','recirculating','jam_clearing','calibrating','maintenance'], forbidden: ['misroute_rate_exceeded','jam_uncleared','overweight_on_sorter'] },
      odd_description: 'High-speed automated package sortation with vision-based routing. System reads labels, routes packages to correct chutes, and recirculates unreadable items. Overweight/oversized packages rejected to manual lane.',
      safety: { violation_action: 'block', fail_closed: true, jam_detection: true, oversize_rejection: true, emergency_stop: true },
    },
  },

  fleet_management_ai: {
    label: 'Fleet Management / Route Optimization AI',
    domain: 'logistics',
    template: {
      numeric: [
        { name: 'max_fleet_size', min: 0, max: 10000, unit: 'vehicles', tolerance: 100 },
        { name: 'max_daily_route_changes', min: 0, max: 50000, unit: 'changes', tolerance: 1000 },
        { name: 'max_driver_hours', min: 0, max: 11, unit: 'hr', tolerance: 0 },
        { name: 'max_fuel_budget_deviation', min: 0, max: 10, unit: '%', tolerance: 1 },
      ],
      geo: { type: 'road_network', description: 'Approved road network with vehicle restrictions — bridge limits, tunnel restrictions, hazmat routes' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'ops_local' },
      states: { allowed: ['planning','dispatching','routing','monitoring','re_routing','reporting'], forbidden: ['hos_violation_dispatched','restricted_road_assigned','overweight_route'] },
      odd_description: 'AI fleet dispatch and route optimization. System assigns loads, optimizes routes, and monitors delivery progress. Hours-of-service limits enforced — cannot dispatch driver beyond legal limits. Vehicle restrictions (weight, height, hazmat) enforced per route segment.',
      safety: { violation_action: 'block', fail_closed: true, hos_compliance: true, vehicle_restrictions: true },
    },
  },

  inventory_management_ai: {
    label: 'Inventory Management / Reorder AI',
    domain: 'logistics',
    template: {
      numeric: [
        { name: 'max_auto_reorder_value', min: 0, max: 100000, unit: 'USD', tolerance: 5000 },
        { name: 'max_sku_count', min: 0, max: 1000000, unit: 'SKUs', tolerance: 10000 },
        { name: 'max_price_deviation', min: 0, max: 5, unit: '%', tolerance: 0.5 },
      ],
      geo: { type: 'logical', description: 'Connected warehouse and ERP systems — approved vendor list and procurement channels' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'ops_local' },
      states: { allowed: ['monitoring','forecasting','reorder_generated','po_created','receiving','reconciling'], forbidden: ['unapproved_vendor','price_deviation_exceeded','budget_exceeded'] },
      odd_description: 'AI-driven demand forecasting and automatic reorder point management. System generates purchase orders within approved vendor list and budget limits. Orders exceeding thresholds require human approval.',
      safety: { violation_action: 'block', fail_closed: true, budget_enforcement: true, vendor_approval: true, human_escalation: true },
    },
  },

  cold_chain_monitor: {
    label: 'Cold Chain Monitoring AI',
    domain: 'logistics',
    template: {
      numeric: [
        { name: 'temperature_min', min: -25, max: null, unit: '°C', tolerance: 0.5 },
        { name: 'temperature_max', min: 0, max: 8, unit: '°C', tolerance: 0.5 },
        { name: 'max_excursion_duration', min: 0, max: 30, unit: 'min', tolerance: 2 },
        { name: 'max_door_open_time', min: 0, max: 5, unit: 'min', tolerance: 0.5 },
      ],
      geo: { type: 'logical', description: 'Cold chain from origin to destination — sensors in trucks, warehouses, and retail cases' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'UTC' },
      states: { allowed: ['monitoring','alerting','logging','reporting','audit_mode'], forbidden: ['excursion_exceeded_unreported','sensor_offline_unnoticed','falsified_log'] },
      odd_description: 'End-to-end cold chain temperature monitoring for pharmaceuticals and food. System logs continuous temperature data, alerts on excursions, and generates compliance reports. Cannot modify temperature logs. FDA 21 CFR Part 11 compliant where required.',
      safety: { violation_action: 'warn', fail_closed: true, tamper_evident_logging: true, immediate_alert: true },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // RETAIL & HOSPITALITY
  // ══════════════════════════════════════════════════════════════════════════

  retail_shelf_scanning_robot: {
    label: 'Retail Shelf-Scanning Robot',
    domain: 'retail_hospitality',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 3, unit: 'km/h', tolerance: 0.3 },
        { name: 'max_aisle_width_required', min: 1, max: null, unit: 'm', tolerance: 0.1 },
        { name: 'scan_frequency', min: 0, max: 3, unit: 'scans/day', tolerance: 0 },
      ],
      geo: { type: 'floor_plan', description: 'Retail store floor plan — approved aisles and scan paths, excludes back of house, checkout lanes during busy periods' },
      time: { operating_hours: '22:00-06:00', operating_days: [0,1,2,3,4,5,6], timezone: 'store_local' },
      states: { allowed: ['docked','scanning','navigating','obstacle_wait','returning','charging'], forbidden: ['customer_collision_risk','aisle_blocked_forcing','store_open_peak_hours'] },
      odd_description: 'Autonomous shelf-scanning robot for inventory accuracy during off-hours. System navigates store aisles, captures shelf images, and identifies out-of-stocks. Operates primarily during closed or low-traffic hours.',
      safety: { violation_action: 'block', fail_closed: true, pedestrian_avoidance: true, emergency_stop: true },
    },
  },

  hotel_service_robot: {
    label: 'Hotel / Hospitality Service Robot',
    domain: 'retail_hospitality',
    template: {
      numeric: [
        { name: 'max_speed', min: 0, max: 3, unit: 'km/h', tolerance: 0.3 },
        { name: 'max_payload', min: 0, max: 10, unit: 'kg', tolerance: 0.5 },
        { name: 'max_noise_level', min: 0, max: 50, unit: 'dB', tolerance: 2 },
      ],
      geo: { type: 'floor_plan', description: 'Hotel corridors and elevator system — excludes guest rooms (delivery to door only), kitchen prep areas, pool deck' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'hotel_local' },
      states: { allowed: ['docked','delivering','returning','elevator_transit','waiting_at_door','charging'], forbidden: ['guest_room_entry','speed_exceeded_lobby','noise_exceeded_night'] },
      odd_description: 'Hotel room service and amenity delivery robot. System delivers items to guest room doors via corridors and elevators. Does not enter rooms. Reduced speed in lobby, noise limits during quiet hours.',
      safety: { violation_action: 'block', fail_closed: true, no_room_entry: true, quiet_hours: true, emergency_stop: true },
    },
  },

  restaurant_kitchen_robot: {
    label: 'Restaurant Kitchen Automation Robot',
    domain: 'retail_hospitality',
    template: {
      numeric: [
        { name: 'max_oil_temperature', min: 0, max: 190, unit: '°C', tolerance: 2 },
        { name: 'max_grill_temperature', min: 0, max: 300, unit: '°C', tolerance: 5 },
        { name: 'max_portion_deviation', min: 0, max: 5, unit: '%', tolerance: 1 },
        { name: 'max_orders_per_hour', min: 0, max: 200, unit: 'orders/hr', tolerance: 10 },
      ],
      geo: { type: 'workspace', description: 'Kitchen prep and cook stations — human exclusion zones around hot equipment during autonomous operation' },
      time: { operating_hours: '10:00-23:00', operating_days: [0,1,2,3,4,5,6], timezone: 'restaurant_local' },
      states: { allowed: ['idle','prepping','cooking','plating','cleaning','maintenance'], forbidden: ['human_in_hot_zone','oil_overtemp','fire_suppression_triggered'] },
      odd_description: 'Automated food preparation and cooking for quick-service restaurant. System handles repetitive cooking tasks (frying, grilling, assembly) within enclosed stations. Human exclusion zones around hot equipment.',
      safety: { violation_action: 'block', fail_closed: true, fire_suppression: true, temperature_limits: true, human_exclusion: true, emergency_stop: true },
    },
  },

  autonomous_checkout: {
    label: 'Autonomous Checkout / Just Walk Out',
    domain: 'retail_hospitality',
    template: {
      numeric: [
        { name: 'max_concurrent_shoppers', min: 0, max: 200, unit: 'shoppers', tolerance: 10 },
        { name: 'max_item_price', min: 0, max: 500, unit: 'USD', tolerance: 10 },
        { name: 'min_detection_accuracy', min: 0.95, max: null, unit: 'ratio', tolerance: 0.01 },
        { name: 'max_charge_latency', min: 0, max: 60, unit: 'min', tolerance: 5 },
      ],
      geo: { type: 'polygon', description: 'Store sensor coverage area — entry/exit gates, shelf sensors, camera zones' },
      time: { operating_hours: '06:00-23:00', operating_days: [0,1,2,3,4,5,6], timezone: 'store_local' },
      states: { allowed: ['monitoring','tracking','cart_building','checkout_processing','dispute_queue'], forbidden: ['charge_without_confidence','privacy_zone_recording','minor_unaccompanied_alcohol'] },
      odd_description: 'Computer vision-based autonomous checkout system. System tracks item selection and charges on exit. Low-confidence transactions queued for human review. Privacy zones in fitting rooms and restrooms.',
      safety: { violation_action: 'block', fail_closed: false, human_review_queue: true, privacy_zones: true, dispute_process: true },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // EDUCATION & RESEARCH
  // ══════════════════════════════════════════════════════════════════════════

  research_lab_robot: {
    label: 'Research Lab Automation Robot',
    domain: 'education_research',
    template: {
      numeric: [
        { name: 'max_experiments_per_day', min: 0, max: 100, unit: 'experiments', tolerance: 5 },
        { name: 'max_reagent_volume', min: 0, max: 50, unit: 'mL', tolerance: 0.5 },
        { name: 'temperature_control_range', min: -20, max: 100, unit: '°C', tolerance: 0.5 },
      ],
      geo: { type: 'workspace', description: 'Lab bench and instrument footprint — fume hood, biosafety cabinet, instrument cluster' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'lab_local' },
      states: { allowed: ['idle','experiment_running','sample_prep','analysis','data_collection','cleaning'], forbidden: ['reagent_incompatibility','fume_hood_closed_volatile','biosafety_breach'] },
      odd_description: 'Laboratory automation for high-throughput experimentation. System executes experiment protocols with reagent handling, incubation, and measurement. Safety interlocks for volatile chemicals and biological materials.',
      safety: { violation_action: 'block', fail_closed: true, chemical_compatibility: true, biosafety_interlock: true, emergency_stop: true },
    },
  },

  educational_tutoring_ai: {
    label: 'Educational Tutoring AI',
    domain: 'education_research',
    template: {
      numeric: [
        { name: 'max_session_duration', min: 0, max: 120, unit: 'min', tolerance: 5 },
        { name: 'max_daily_sessions_per_student', min: 0, max: 5, unit: 'sessions', tolerance: 0 },
        { name: 'min_age_requirement', min: 5, max: null, unit: 'years', tolerance: 0 },
      ],
      geo: { type: 'logical', description: 'Approved curriculum content and grade levels — content filtered by age appropriateness' },
      time: { operating_hours: '06:00-22:00', operating_days: [0,1,2,3,4,5,6], timezone: 'student_local' },
      states: { allowed: ['idle','tutoring','assessing','reviewing','reporting_to_teacher'], forbidden: ['off_curriculum_content','personal_data_collection_unauthorized','session_exceeded'] },
      odd_description: 'AI tutoring system for K-12 students within approved curriculum. System provides personalized instruction, practice, and assessment. Content restricted to grade-appropriate material. Teacher oversight and progress reporting. COPPA/FERPA compliant.',
      safety: { violation_action: 'block', fail_closed: true, age_appropriate_content: true, coppa_compliant: true, teacher_oversight: true },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LEGAL & COMPLIANCE
  // ══════════════════════════════════════════════════════════════════════════

  contract_review_ai: {
    label: 'Contract Review AI',
    domain: 'legal_compliance',
    template: {
      numeric: [
        { name: 'max_documents_per_day', min: 0, max: 1000, unit: 'documents', tolerance: 50 },
        { name: 'max_auto_approve_value', min: 0, max: 0, unit: 'USD', tolerance: 0 },
        { name: 'min_extraction_confidence', min: 0.90, max: null, unit: 'score', tolerance: 0.02 },
      ],
      geo: { type: 'logical', description: 'Connected document management system — approved contract types and clause libraries' },
      time: { operating_hours: '00:00-23:59', operating_days: [1,2,3,4,5], timezone: 'firm_local' },
      states: { allowed: ['idle','reviewing','extracting','flagging','summarizing','reporting'], forbidden: ['auto_approval','legal_advice_given','privileged_content_exposed'] },
      odd_description: 'AI-assisted contract review for clause extraction, risk flagging, and comparison against standard terms. System highlights deviations and risks for attorney review. Cannot approve contracts or provide legal advice. Attorney-client privilege protected.',
      safety: { violation_action: 'block', fail_closed: true, attorney_review_required: true, privilege_protection: true },
    },
  },

  regulatory_compliance_monitor: {
    label: 'Regulatory Compliance Monitor AI',
    domain: 'legal_compliance',
    template: {
      numeric: [
        { name: 'max_rules_monitored', min: 0, max: 50000, unit: 'rules', tolerance: 500 },
        { name: 'update_frequency', min: 0, max: 24, unit: 'hr', tolerance: 1 },
        { name: 'max_false_alert_rate', min: 0, max: 5, unit: '%', tolerance: 1 },
      ],
      geo: { type: 'logical', description: 'Connected regulatory databases and internal policy systems — approved jurisdictions and regulatory bodies' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'institution_local' },
      states: { allowed: ['monitoring','analyzing','alerting','reporting','updating_rules'], forbidden: ['compliance_certification_issued','regulation_interpretation_given','alert_suppressed'] },
      odd_description: 'Regulatory change monitoring and compliance gap analysis. System tracks regulatory updates across jurisdictions and flags potential impacts to compliance team. Cannot certify compliance or interpret regulations — compliance officer review required.',
      safety: { violation_action: 'warn', fail_closed: true, compliance_officer_review: true, audit_trail: true },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // OTHER / CUSTOM
  // ══════════════════════════════════════════════════════════════════════════

  custom_system: {
    label: 'Custom / Other System',
    domain: 'other',
    template: {
      numeric: [],
      geo: { type: 'custom', description: 'Define your operational boundary — geographic, logical, or physical workspace' },
      time: { operating_hours: '00:00-23:59', operating_days: [0,1,2,3,4,5,6], timezone: 'ops_local' },
      states: { allowed: [], forbidden: [] },
      odd_description: '',
      safety: { violation_action: 'block', fail_closed: true, emergency_stop: true },
    },
  },

};

// ── Helper: Get all types for a domain ──
export const getTypesByDomain = (domainKey) =>
  Object.entries(SYSTEM_TYPES)
    .filter(([, v]) => v.domain === domainKey)
    .map(([key, v]) => ({ key, ...v }));

// ── Helper: Count ──
export const TOTAL_SYSTEM_TYPES = Object.keys(SYSTEM_TYPES).length;
