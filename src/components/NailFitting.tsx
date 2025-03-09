import { useState, useEffect } from "react";
import { fetchData } from "../lib/database";
import { ensureAuthenticated } from "../lib/supabase";
import { supabase } from "../lib/supabase";
import {
  NailTipSet as BaseNailTipSet,
  NailTipSize,
  Brand,
} from "../types/database";
import { Combobox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { SelectClientModal } from "./SelectClientModal";
import leftHandImage from "../assets/images/left-hand.png";
import rightHandImage from "../assets/images/right-hand.png";

interface NailTipSet extends BaseNailTipSet {
  brand: string;
}

interface Client {
  id: number;
  name: string;
  notes: string | null;
  created_at?: string;
  nail_tech_id: string;
}

interface FingerMeasurement {
  finger_position: string;
  nail_bed_width: number;
  nail_bed_curve?: number;
  id?: number;
  client_id?: number;
  nail_tip_set_id?: number;
  date_measured?: string;
  client_name?: string;
  notes?: string;
}

interface NailFittingProps {
  clientId?: number;
}

interface MatchedSizes {
  width?: NailTipSize[];
  curve?: NailTipSize[];
  availableSizes?: NailTipSize[];
}

interface NailSetDisplay extends NailTipSet {
  displayName: string;
}

interface ClientInfo {
  name: string;
  notes: string;
}

const DEFAULT_MEASUREMENTS: FingerMeasurement[] = [
  { finger_position: "Left Thumb", nail_bed_width: 0 },
  { finger_position: "Left Index", nail_bed_width: 0 },
  { finger_position: "Left Middle", nail_bed_width: 0 },
  { finger_position: "Left Ring", nail_bed_width: 0 },
  { finger_position: "Left Pinky", nail_bed_width: 0 },
  { finger_position: "Right Thumb", nail_bed_width: 0 },
  { finger_position: "Right Index", nail_bed_width: 0 },
  { finger_position: "Right Middle", nail_bed_width: 0 },
  { finger_position: "Right Ring", nail_bed_width: 0 },
  { finger_position: "Right Pinky", nail_bed_width: 0 },
];

export function NailFitting({ clientId: initialClientId }: NailFittingProps) {
  const [measurements, setMeasurements] =
    useState<FingerMeasurement[]>(DEFAULT_MEASUREMENTS);
  const [originalMeasurements, setOriginalMeasurements] =
    useState<FingerMeasurement[]>(DEFAULT_MEASUREMENTS);
  const [nailSets, setNailSets] = useState<NailSetDisplay[]>([]);
  const [selectedSet, setSelectedSet] = useState<NailSetDisplay | null>(null);
  const [query, setQuery] = useState("");
  const [matchedSizes, setMatchedSizes] = useState<
    Record<string, MatchedSizes>
  >({});
  const [allSizes, setAllSizes] = useState<NailTipSize[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    name: "",
    notes: "",
  });
  const [shakeError, setShakeError] = useState(false);
  const [isSelectClientModalOpen, setIsSelectClientModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(
    initialClientId || null
  );
  const [preferSmallerSizes, setPreferSmallerSizes] = useState(true);
  const [useTaperedCompensation, setUseTaperedCompensation] = useState(true);
  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    async function init() {
      try {
        // Ensure we're authenticated before making any database calls
        await ensureAuthenticated();
        await loadNailSets();
        if (selectedClientId) {
          await loadSavedMeasurements();
        }
      } catch (error) {
        console.error("Initialization error:", error);
      }
    }
    init();
  }, [selectedClientId]);

  useEffect(() => {
    async function loadSizes() {
      if (!selectedSet) {
        setAllSizes([]);
        return;
      }

      try {
        const sizes = await fetchData<NailTipSize>(
          "Nail Tip Sizes",
          `tip_set_id = ${selectedSet.id}`
        );
        setAllSizes(sizes.sort((a, b) => b.width - a.width));
      } catch (error) {
        console.error("Error loading sizes:", error);
      }
    }

    loadSizes();
  }, [selectedSet]);

  async function loadNailSets() {
    try {
      // Fetch nail tip sets
      const sets = await fetchData<NailTipSet>("Nail Tip Sets");
      // Fetch all brands
      const brands = await fetchData<Brand>("Brand");

      const setsWithDisplay = sets.map((set) => {
        const brand = brands.find((b) => b.id === set.brand_id);
        return {
          ...set,
          brand: brand?.name || "Unknown",
          displayName: `${brand?.name || "Unknown"} ${set.name} ${set.shape} ${
            set.length || ""
          }`.trim(),
        };
      });
      setNailSets(setsWithDisplay);
    } catch (error) {
      console.error("Error loading nail sets:", error);
    }
  }

  async function loadSavedMeasurements() {
    try {
      setLoading(true);
      // Fetch the most recent measurements for this client
      const savedMeasurements = await fetchData<FingerMeasurement>(
        "Measurements",
        `client_id = ${selectedClientId} ORDER BY date_measured DESC`
      );

      if (savedMeasurements.length > 0) {
        // Group by date_measured to get the most recent complete set
        const measurementsByDate = savedMeasurements.reduce(
          (acc, measurement) => {
            const date = measurement.date_measured;
            if (!acc[date!]) {
              acc[date!] = [];
            }
            acc[date!].push(measurement);
            return acc;
          },
          {} as Record<string, FingerMeasurement[]>
        );

        // Get the most recent complete set (should have 10 measurements)
        const mostRecentDate = Object.keys(measurementsByDate)[0];
        const mostRecentSet = measurementsByDate[mostRecentDate];

        if (mostRecentSet.length === 10) {
          // Sort measurements to match our default order
          const sortedMeasurements = DEFAULT_MEASUREMENTS.map(
            (defaultMeasurement) => {
              const savedMeasurement = mostRecentSet.find(
                (m) => m.finger_position === defaultMeasurement.finger_position
              );
              return savedMeasurement || defaultMeasurement;
            }
          );

          setMeasurements(sortedMeasurements);
          setOriginalMeasurements(sortedMeasurements); // Store original measurements

          // If there's a nail tip set associated, select it
          if (mostRecentSet[0].nail_tip_set_id) {
            const associatedSet = nailSets.find(
              (set) => set.id === mostRecentSet[0].nail_tip_set_id
            );
            if (associatedSet) {
              setSelectedSet(associatedSet);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading saved measurements:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleMeasurementChange(
    index: number,
    field: keyof Omit<FingerMeasurement, "finger_position">,
    value: string
  ) {
    const newMeasurements = [...measurements];
    newMeasurements[index] = {
      ...newMeasurements[index],
      [field]: parseFloat(value) || 0,
    };
    setMeasurements(newMeasurements);
  }

  async function handleSaveClick() {
    if (!clientInfo.name.trim()) {
      setShakeError(true);
      setTimeout(() => setShakeError(false), 820);
      return;
    }

    try {
      setSaveStatus("saving");
      await ensureAuthenticated();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(userError?.message || "No authenticated user found");
      }

      // Check user credits
      const { data: userCredits, error: creditsError } = await supabase
        .from("User Credits")
        .select("credits, is_admin")
        .eq("user_id", user.id)
        .single();

      if (creditsError) {
        console.error("Error fetching user credits:", creditsError);
      }

      if (!userCredits || (!userCredits.is_admin && userCredits.credits <= 0)) {
        throw new Error("Insufficient credits");
      }

      // Create new client
      const { data: newClient, error: clientError } = await supabase
        .from("Clients")
        .insert({
          name: clientInfo.name,
          notes: clientInfo.notes || null,
          nail_tech_id: user.id,
        })
        .select()
        .single();

      if (clientError || !newClient) {
        throw new Error("Failed to create client record");
      }

      // Save measurements for new client
      const validMeasurements = measurements
        .filter((measurement) => measurement.nail_bed_width > 0)
        .map((measurement) => ({
          finger_position: measurement.finger_position,
          nail_bed_width: Number(measurement.nail_bed_width) || 0,
          nail_bed_curve: measurement.nail_bed_curve
            ? Number(measurement.nail_bed_curve)
            : null,
          date_measured: new Date().toISOString(),
          client_id: newClient.id,
        }));

      if (validMeasurements.length === 0) {
        throw new Error("No valid measurements to save");
      }

      const { error: measurementsError } = await supabase
        .from("Measurements")
        .insert(validMeasurements);

      if (measurementsError) {
        console.error("Measurements error:", measurementsError);
        throw new Error("Failed to save measurements");
      }

      // Deduct credit if not admin
      if (!userCredits.is_admin) {
        await supabase
          .from("User Credits")
          .update({ credits: userCredits.credits - 1 })
          .eq("user_id", user.id);
      }

      setSaveStatus("saved");
      setClientInfo({
        name: "",
        notes: "",
      });
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (error) {
      console.error("Error saving:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  async function handleUpdateClick() {
    if (!selectedClientId) {
      console.error("No client ID available for update");
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
      return;
    }

    try {
      setSaveStatus("saving");
      await ensureAuthenticated();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(userError?.message || "No authenticated user found");
      }

      // Check user credits
      const { data: userCredits, error: creditsError } = await supabase
        .from("User Credits")
        .select("credits, is_admin")
        .eq("user_id", user.id)
        .single();

      if (creditsError) {
        console.error("Error fetching user credits:", creditsError);
      }

      if (!userCredits || (!userCredits.is_admin && userCredits.credits <= 0)) {
        throw new Error("Insufficient credits");
      }

      // Find which measurements have changed
      const changedMeasurements = measurements.filter((measurement, index) => {
        const original = originalMeasurements[index];
        return (
          measurement.nail_bed_width !== original.nail_bed_width ||
          measurement.nail_bed_curve !== original.nail_bed_curve
        );
      });

      if (changedMeasurements.length === 0) {
        console.log("No measurements have changed");
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 3000);
        return;
      }

      // For each changed measurement, update or insert
      for (const measurement of changedMeasurements) {
        // First, try to find an existing measurement for this finger position
        const { data: existingMeasurements } = await supabase
          .from("Measurements")
          .select("id")
          .eq("client_id", selectedClientId)
          .eq("finger_position", measurement.finger_position)
          .order("date_measured", { ascending: false })
          .limit(1);

        const measurementData = {
          finger_position: measurement.finger_position,
          nail_bed_width: Number(measurement.nail_bed_width) || 0,
          nail_bed_curve: measurement.nail_bed_curve
            ? Number(measurement.nail_bed_curve)
            : null,
          date_measured: new Date().toISOString(),
          client_id: selectedClientId,
        };

        if (existingMeasurements && existingMeasurements.length > 0) {
          // Update existing measurement
          const { error: updateError } = await supabase
            .from("Measurements")
            .update(measurementData)
            .eq("id", existingMeasurements[0].id);

          if (updateError) {
            console.error("Update error:", updateError);
            throw new Error("Failed to update measurement");
          }
        } else {
          // Insert new measurement
          const { error: insertError } = await supabase
            .from("Measurements")
            .insert(measurementData);

          if (insertError) {
            console.error("Insert error:", insertError);
            throw new Error("Failed to insert measurement");
          }
        }
      }

      // Deduct credit if not admin
      if (!userCredits.is_admin) {
        await supabase
          .from("User Credits")
          .update({ credits: userCredits.credits - 1 })
          .eq("user_id", user.id);
      }

      // Update original measurements to reflect the new state
      setOriginalMeasurements(measurements);

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (error) {
      console.error("Error updating:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  // Add cleanup function for orphaned measurements
  async function cleanupOrphanedMeasurements() {
    try {
      await ensureAuthenticated();

      // First, get all client IDs
      const { data: clients, error: clientsError } = await supabase
        .from("Clients")
        .select("id");

      if (clientsError) {
        throw new Error("Failed to fetch clients");
      }

      const validClientIds = clients.map((client) => client.id);

      // Delete measurements for non-existent clients
      const { error: deleteError } = await supabase
        .from("Measurements")
        .delete()
        .not("client_id", "in", `(${validClientIds.join(",")})`);

      if (deleteError) {
        throw new Error("Failed to delete orphaned measurements");
      }
    } catch (error) {
      console.error("Error cleaning up orphaned measurements:", error);
    }
  }

  // Call cleanup on component mount
  useEffect(() => {
    cleanupOrphanedMeasurements();
  }, []);

  // Filter nail sets based on search query
  const filteredNailSets =
    query === ""
      ? nailSets
      : nailSets.filter((set) =>
          set.displayName.toLowerCase().includes(query.toLowerCase())
        );

  async function findMatchingSizes() {
    if (!selectedSet) return;

    try {
      setLoading(true);
      const sizes = await fetchData<NailTipSize>(
        "Nail Tip Sizes",
        `tip_set_id = ${selectedSet.id}`
      );

      const matches: Record<string, MatchedSizes> = {};
      const isTaperedShape =
        selectedSet.shape.toLowerCase().includes("almond") ||
        selectedSet.shape.toLowerCase().includes("stilleto");

      measurements.forEach((measurement) => {
        const matchResult: MatchedSizes = {
          availableSizes: sizes,
        };

        if (measurement.nail_bed_width > 0) {
          const targetWidth =
            isTaperedShape && useTaperedCompensation
              ? measurement.nail_bed_width + 0.5
              : measurement.nail_bed_width;

          // Calculate scores for each size based on both width and curve
          const sizesWithScores = sizes.map((size) => {
            const widthDiff = Math.abs(size.width - targetWidth);
            const curveDiff = measurement.nail_bed_curve
              ? Math.abs((size.inner_curve || 0) - measurement.nail_bed_curve)
              : 0;

            // Combined score weighs both width and curve equally
            const score =
              widthDiff + (measurement.nail_bed_curve ? curveDiff : 0);

            return {
              ...size,
              score,
              widthDiff,
              curveDiff,
            };
          });

          // Sort by combined score for perfect fit
          sizesWithScores.sort((a, b) => a.score - b.score);
          const perfectFit = sizesWithScores[0];

          // Sort by width difference for comfort fit
          const sizesByWidth = [...sizesWithScores].sort(
            (a, b) => a.widthDiff - b.widthDiff
          );
          const comfortFit = sizesByWidth[0];

          // Sort by curve difference for tight fit (if curve measurement exists)
          let tightFit;
          if (measurement.nail_bed_curve) {
            const sizesByCurve = [...sizesWithScores].sort(
              (a, b) => a.curveDiff - b.curveDiff
            );
            tightFit = sizesByCurve[0];
          }

          // Store the matches
          matches[measurement.finger_position] = {
            ...matchResult,
            width: comfortFit ? [comfortFit] : undefined,
            curve: tightFit ? [tightFit] : undefined,
            availableSizes: [perfectFit],
          };
        }
      });

      setMatchedSizes(matches);
    } catch (error) {
      console.error("Error finding matching sizes:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleClientSelect(selectedClientId: number) {
    try {
      setLoading(true);
      setIsUpdating(true);
      setSelectedClientId(selectedClientId);

      // Fetch client info
      const [client] = await fetchData<Client>(
        "Clients",
        `id = ${selectedClientId}`
      );
      if (client) {
        setClientInfo({
          name: client.name,
          notes: client.notes || "",
        });
      }

      // Fetch the most recent measurements for this client
      const savedMeasurements = await fetchData<FingerMeasurement>(
        "Measurements",
        `client_id = ${selectedClientId} ORDER BY date_measured DESC`
      );

      if (savedMeasurements.length > 0) {
        // Group by date_measured to get the most recent complete set
        const measurementsByDate = savedMeasurements.reduce(
          (acc, measurement) => {
            const date = measurement.date_measured;
            if (!acc[date!]) {
              acc[date!] = [];
            }
            acc[date!].push(measurement);
            return acc;
          },
          {} as Record<string, FingerMeasurement[]>
        );

        // Get the most recent complete set (should have 10 measurements)
        const mostRecentDate = Object.keys(measurementsByDate)[0];
        const mostRecentSet = measurementsByDate[mostRecentDate];

        if (mostRecentSet.length === 10) {
          // Sort measurements to match our default order
          const sortedMeasurements = DEFAULT_MEASUREMENTS.map(
            (defaultMeasurement) => {
              const savedMeasurement = mostRecentSet.find(
                (m) => m.finger_position === defaultMeasurement.finger_position
              );
              return savedMeasurement || defaultMeasurement;
            }
          );

          setMeasurements(sortedMeasurements);
          setOriginalMeasurements(sortedMeasurements); // Store original measurements

          // If there's a nail tip set associated, select it
          if (mostRecentSet[0].nail_tip_set_id) {
            const associatedSet = nailSets.find(
              (set) => set.id === mostRecentSet[0].nail_tip_set_id
            );
            if (associatedSet) {
              setSelectedSet(associatedSet);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading client data:", error);
    } finally {
      setLoading(false);
    }
  }

  // Add function to check if measurements have changed
  const hasMeasurementsChanged = () => {
    return measurements.some((measurement, index) => {
      const original = originalMeasurements[index];
      return (
        measurement.nail_bed_width !== original.nail_bed_width ||
        measurement.nail_bed_curve !== original.nail_bed_curve
      );
    });
  };

  // Add function to check if any measurements have been entered
  const hasAnyMeasurements = () => {
    return measurements.some(
      (measurement) =>
        measurement.nail_bed_width > 0 ||
        (measurement.nail_bed_curve !== undefined &&
          measurement.nail_bed_curve > 0)
    );
  };

  return (
    <div className="w-full h-full min-h-full flex flex-col">
      {/* Step Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between">
            <div className="flex space-x-8">
              <button
                onClick={() => setActiveStep(1)}
                className={`${
                  activeStep === 1
                    ? "border-gray-500 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Step 1: Client Info
              </button>
              <button
                onClick={() => setActiveStep(2)}
                className={`${
                  activeStep === 2
                    ? "border-gray-500 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Step 2: Measurements
              </button>
              <button
                onClick={() => setActiveStep(3)}
                className={`${
                  activeStep === 3
                    ? "border-gray-500 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Step 3: Size Match
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Step 1: Client Information */}
          {activeStep === 1 && (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Client Information
                </h2>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Client Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={clientInfo.name}
                      onChange={(e) =>
                        setClientInfo({ ...clientInfo, name: e.target.value })
                      }
                      className={`mt-1 block w-full rounded-md border ${
                        shakeError ? "border-red-500 shake" : "border-gray-300"
                      } bg-white px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 sm:text-sm`}
                      required
                    />
                    {shakeError && (
                      <p className="mt-1 text-sm text-red-500">
                        Client name is required
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="notes"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Notes
                    </label>
                    <textarea
                      id="notes"
                      value={clientInfo.notes}
                      onChange={(e) =>
                        setClientInfo({ ...clientInfo, notes: e.target.value })
                      }
                      rows={3}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 sm:text-sm"
                    />
                  </div>
                  <div className="flex justify-between">
                    <button
                      type="button"
                      onClick={() => setIsSelectClientModalOpen(true)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      Select Existing Client
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveStep(2)}
                      disabled={!clientInfo.name.trim()}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Next: Enter Measurements
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Measurements */}
          {activeStep === 2 && (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Enter Measurements
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Hand */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
                      Left Hand
                    </h3>
                    <div className="relative w-full max-w-[400px] mx-auto aspect-square">
                      <img
                        src={leftHandImage}
                        alt="Left Hand"
                        className="object-contain w-full h-full"
                      />
                      {/* Interactive measurement points will be added here */}
                    </div>
                    <div className="mt-6">
                      <div className="flex flex-wrap gap-4">
                        {measurements.slice(0, 5).map((measurement, index) => (
                          <div
                            key={index}
                            className="flex-1 min-w-[200px] p-3 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <label className="block text-sm font-medium text-gray-900">
                                {measurement.finger_position.replace(
                                  "Left ",
                                  ""
                                )}
                              </label>
                              <div className="mt-1 flex space-x-4">
                                <div>
                                  <label className="block text-xs text-gray-500">
                                    Width (mm)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={measurement.nail_bed_width || ""}
                                    onChange={(e) =>
                                      handleMeasurementChange(
                                        index,
                                        "nail_bed_width",
                                        e.target.value
                                      )
                                    }
                                    className="mt-1 block w-20 rounded-md border border-gray-300 bg-white py-2 px-3 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500">
                                    Curve (mm)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={measurement.nail_bed_curve || ""}
                                    onChange={(e) =>
                                      handleMeasurementChange(
                                        index,
                                        "nail_bed_curve",
                                        e.target.value
                                      )
                                    }
                                    className="mt-1 block w-20 rounded-md border border-gray-300 bg-white py-2 px-3 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Hand */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
                      Right Hand
                    </h3>
                    <div className="relative w-full max-w-[400px] mx-auto aspect-square">
                      <img
                        src={rightHandImage}
                        alt="Right Hand"
                        className="object-contain w-full h-full"
                      />
                      {/* Interactive measurement points will be added here */}
                    </div>
                    <div className="mt-6">
                      <div className="flex flex-wrap gap-4">
                        {measurements.slice(5).map((measurement, index) => (
                          <div
                            key={index + 5}
                            className="flex-1 min-w-[200px] p-3 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <label className="block text-sm font-medium text-gray-900">
                                {measurement.finger_position.replace(
                                  "Right ",
                                  ""
                                )}
                              </label>
                              <div className="mt-1 flex space-x-4">
                                <div>
                                  <label className="block text-xs text-gray-500">
                                    Width (mm)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={measurement.nail_bed_width || ""}
                                    onChange={(e) =>
                                      handleMeasurementChange(
                                        index + 5,
                                        "nail_bed_width",
                                        e.target.value
                                      )
                                    }
                                    className="mt-1 block w-20 rounded-md border border-gray-300 bg-white py-2 px-3 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500">
                                    Curve (mm)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={measurement.nail_bed_curve || ""}
                                    onChange={(e) =>
                                      handleMeasurementChange(
                                        index + 5,
                                        "nail_bed_curve",
                                        e.target.value
                                      )
                                    }
                                    className="mt-1 block w-20 rounded-md border border-gray-300 bg-white py-2 px-3 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStep(3)}
                    disabled={!hasAnyMeasurements()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Next: Find Matching Sizes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Size Matching */}
          {activeStep === 3 && (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Find Matching Sizes
                </h2>
                <div className="space-y-4">
                  {/* Nail Tip Set Selection */}
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <Combobox value={selectedSet} onChange={setSelectedSet}>
                        <div className="relative">
                          <div className="relative w-full">
                            <Combobox.Input
                              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 text-base"
                              onChange={(event) => setQuery(event.target.value)}
                              displayValue={(set: NailSetDisplay | null) =>
                                set?.displayName || ""
                              }
                              placeholder="Select or search a nail tip set..."
                            />
                            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                              <ChevronUpDownIcon
                                className="h-5 w-5 text-gray-400"
                                aria-hidden="true"
                              />
                            </Combobox.Button>
                          </div>

                          <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                            {filteredNailSets.length === 0 && query !== "" ? (
                              <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                                Nothing found.
                              </div>
                            ) : (
                              filteredNailSets.map((set) => (
                                <Combobox.Option
                                  key={set.id}
                                  className={({ active }) =>
                                    `relative cursor-default select-none py-2 pl-3 pr-9 ${
                                      active
                                        ? "bg-gray-100 text-gray-900"
                                        : "text-gray-900"
                                    }`
                                  }
                                  value={set}
                                >
                                  {set.displayName}
                                </Combobox.Option>
                              ))
                            )}
                          </Combobox.Options>
                        </div>
                      </Combobox>
                    </div>
                    <button
                      type="button"
                      onClick={findMatchingSizes}
                      disabled={!selectedSet || loading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 whitespace-nowrap"
                    >
                      {loading ? "Finding matches..." : "Find Matches"}
                    </button>
                  </div>

                  {/* Size Matching Options */}
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="prefer-smaller-sizes"
                        checked={preferSmallerSizes}
                        onChange={(e) =>
                          setPreferSmallerSizes(e.target.checked)
                        }
                        className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300 rounded"
                      />
                      <label
                        htmlFor="prefer-smaller-sizes"
                        className="ml-2 block text-sm text-gray-700"
                      >
                        Prefer smaller sizes (when unchecked, finds closest
                        match)
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="tapered-compensation"
                        checked={useTaperedCompensation}
                        onChange={(e) =>
                          setUseTaperedCompensation(e.target.checked)
                        }
                        className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300 rounded"
                      />
                      <label
                        htmlFor="tapered-compensation"
                        className="ml-2 block text-sm text-gray-700"
                      >
                        Add 0.5mm for tapered shapes (almond/stiletto)
                      </label>
                    </div>
                  </div>

                  {/* Size Table */}
                  {selectedSet && (
                    <div className="mt-4 bg-white rounded-lg shadow overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th
                                scope="col"
                                className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-center"
                              >
                                Size Label
                              </th>
                              {allSizes.map((size) => (
                                <th
                                  key={size.id}
                                  scope="col"
                                  className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-center"
                                >
                                  {size.size_label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            <tr>
                              <td className="px-2 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                                Width
                              </td>
                              {allSizes.map((size) => (
                                <td
                                  key={size.id}
                                  className="px-2 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
                                >
                                  {size.width}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="px-2 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                                Length
                              </td>
                              {allSizes.map((size) => (
                                <td
                                  key={size.id}
                                  className="px-2 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
                                >
                                  {size.length}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td className="px-2 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                                IC
                              </td>
                              {allSizes.map((size) => (
                                <td
                                  key={size.id}
                                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
                                >
                                  {size.inner_curve || "-"}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Size Matching Results */}
                  {selectedSet && Object.keys(matchedSizes).length > 0 && (
                    <div className="mt-6">
                      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg
                              className="h-5 w-5 text-blue-400"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-blue-700">
                              All measurements are in millimeters (mm)
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col lg:flex-row gap-6">
                        {/* Left Hand Results */}
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900 mb-4">
                            Left Hand
                          </h3>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th
                                    scope="col"
                                    className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                                  >
                                    Fit Type
                                  </th>
                                  {measurements
                                    .slice(0, 5)
                                    .map((measurement, index) => (
                                      <th
                                        key={index}
                                        scope="col"
                                        className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                      >
                                        {measurement.finger_position.replace(
                                          "Left ",
                                          ""
                                        )}
                                      </th>
                                    ))}
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {/* Client Measurements Row */}
                                <tr>
                                  <td className="px-2 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                                    Client
                                  </td>
                                  {measurements
                                    .slice(0, 5)
                                    .map((measurement, index) => (
                                      <td
                                        key={index}
                                        className="px-2 py-3 whitespace-nowrap text-sm text-gray-600 text-center"
                                      >
                                        <div>
                                          W: {measurement.nail_bed_width}
                                        </div>
                                        {measurement.nail_bed_curve && (
                                          <div>
                                            C: {measurement.nail_bed_curve}
                                          </div>
                                        )}
                                      </td>
                                    ))}
                                </tr>
                                {/* Perfect Fit Row */}
                                <tr>
                                  <td className="px-2 py-3 whitespace-nowrap text-sm font-medium text-green-700 group relative text-center">
                                    Perfect
                                    <svg
                                      className="inline-block ml-1 h-4 w-4 text-green-700 cursor-help"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 w-72 p-3 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-normal text-center shadow-lg">
                                      Best overall match considering both width
                                      and curve
                                    </div>
                                  </td>
                                  {measurements
                                    .slice(0, 5)
                                    .map((measurement, index) => (
                                      <td
                                        key={index}
                                        className="px-2 py-3 whitespace-nowrap text-sm text-center"
                                      >
                                        {matchedSizes[
                                          measurement.finger_position
                                        ]?.availableSizes?.map((size) => (
                                          <div
                                            key={`perfect-${size.id}`}
                                            className="text-green-700"
                                          >
                                            <span className="font-bold">
                                              {size.size_label}
                                            </span>
                                            <div className="text-xs text-green-600">
                                              W: {size.width}
                                            </div>
                                            {size.inner_curve && (
                                              <div className="text-xs text-green-600">
                                                C: {size.inner_curve}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </td>
                                    ))}
                                </tr>
                                {/* Comfort Fit Row */}
                                <tr>
                                  <td className="px-2 py-3 whitespace-nowrap text-sm font-medium text-blue-700 group relative text-center">
                                    Comfort
                                    <svg
                                      className="inline-block ml-1 h-4 w-4 text-blue-700 cursor-help"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 w-72 p-3 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-normal text-center shadow-lg">
                                      Slightly larger fit for more comfort
                                    </div>
                                  </td>
                                  {measurements
                                    .slice(0, 5)
                                    .map((measurement, index) => (
                                      <td
                                        key={index}
                                        className="px-2 py-3 whitespace-nowrap text-sm text-center"
                                      >
                                        {matchedSizes[
                                          measurement.finger_position
                                        ]?.curve?.map((size) => (
                                          <div
                                            key={`comfort-${size.id}`}
                                            className="text-blue-700"
                                          >
                                            <span className="font-bold">
                                              {size.size_label}
                                            </span>
                                            <div className="text-xs text-blue-600">
                                              W: {size.width}
                                            </div>
                                            {size.inner_curve && (
                                              <div className="text-xs text-blue-600">
                                                C: {size.inner_curve}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </td>
                                    ))}
                                </tr>
                                {/* Tight Fit Row */}
                                <tr>
                                  <td className="px-2 py-3 whitespace-nowrap text-sm font-medium text-yellow-700 group relative text-center">
                                    Tight
                                    <svg
                                      className="inline-block ml-1 h-4 w-4 text-yellow-700 cursor-help"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 w-72 p-3 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-normal text-center shadow-lg">
                                      Snug fit for a more secure hold
                                    </div>
                                  </td>
                                  {measurements
                                    .slice(0, 5)
                                    .map((measurement, index) => (
                                      <td
                                        key={index}
                                        className={`px-2 py-3 whitespace-nowrap text-sm text-center ${
                                          !measurement.nail_bed_curve
                                            ? "opacity-50"
                                            : ""
                                        }`}
                                      >
                                        {matchedSizes[
                                          measurement.finger_position
                                        ]?.width?.map((size) => (
                                          <div
                                            key={`tight-${size.id}`}
                                            className={`text-yellow-700 ${
                                              !measurement.nail_bed_curve
                                                ? "cursor-not-allowed"
                                                : ""
                                            }`}
                                          >
                                            <span className="font-bold">
                                              {size.size_label}
                                            </span>
                                            <div className="text-xs text-yellow-600">
                                              W: {size.width}
                                            </div>
                                            {size.inner_curve && (
                                              <div className="text-xs text-yellow-600">
                                                C: {size.inner_curve}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </td>
                                    ))}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Right Hand Results */}
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900 mb-4">
                            Right Hand
                          </h3>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th
                                    scope="col"
                                    className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                                  >
                                    Fit Type
                                  </th>
                                  {measurements
                                    .slice(5)
                                    .map((measurement, index) => (
                                      <th
                                        key={index}
                                        scope="col"
                                        className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                      >
                                        {measurement.finger_position.replace(
                                          "Right ",
                                          ""
                                        )}
                                      </th>
                                    ))}
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {/* Client Measurements Row */}
                                <tr>
                                  <td className="px-2 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                                    Client
                                  </td>
                                  {measurements
                                    .slice(5)
                                    .map((measurement, index) => (
                                      <td
                                        key={index}
                                        className="px-2 py-3 whitespace-nowrap text-sm text-gray-600 text-center"
                                      >
                                        <div>
                                          W: {measurement.nail_bed_width}
                                        </div>
                                        {measurement.nail_bed_curve && (
                                          <div>
                                            C: {measurement.nail_bed_curve}
                                          </div>
                                        )}
                                      </td>
                                    ))}
                                </tr>
                                {/* Perfect Fit Row */}
                                <tr>
                                  <td className="px-2 py-3 whitespace-nowrap text-sm font-medium text-green-700 group relative text-center">
                                    Perfect
                                    <svg
                                      className="inline-block ml-1 h-4 w-4 text-green-700 cursor-help"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 w-72 p-3 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-normal text-center shadow-lg">
                                      Best overall match considering both width
                                      and curve
                                    </div>
                                  </td>
                                  {measurements
                                    .slice(5)
                                    .map((measurement, index) => (
                                      <td
                                        key={index}
                                        className="px-2 py-3 whitespace-nowrap text-sm text-center"
                                      >
                                        {matchedSizes[
                                          measurement.finger_position
                                        ]?.availableSizes?.map((size) => (
                                          <div
                                            key={`perfect-${size.id}`}
                                            className="text-green-700"
                                          >
                                            <span className="font-bold">
                                              {size.size_label}
                                            </span>
                                            <div className="text-xs text-green-600">
                                              W: {size.width}
                                            </div>
                                            {size.inner_curve && (
                                              <div className="text-xs text-green-600">
                                                C: {size.inner_curve}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </td>
                                    ))}
                                </tr>
                                {/* Comfort Fit Row */}
                                <tr>
                                  <td className="px-2 py-3 whitespace-nowrap text-sm font-medium text-blue-700 group relative text-center">
                                    Comfort
                                    <svg
                                      className="inline-block ml-1 h-4 w-4 text-blue-700 cursor-help"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 w-72 p-3 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-normal text-center shadow-lg">
                                      Slightly larger fit for more comfort
                                    </div>
                                  </td>
                                  {measurements
                                    .slice(5)
                                    .map((measurement, index) => (
                                      <td
                                        key={index}
                                        className="px-2 py-3 whitespace-nowrap text-sm text-center"
                                      >
                                        {matchedSizes[
                                          measurement.finger_position
                                        ]?.curve?.map((size) => (
                                          <div
                                            key={`comfort-${size.id}`}
                                            className="text-blue-700"
                                          >
                                            <span className="font-bold">
                                              {size.size_label}
                                            </span>
                                            <div className="text-xs text-blue-600">
                                              W: {size.width}
                                            </div>
                                            {size.inner_curve && (
                                              <div className="text-xs text-blue-600">
                                                C: {size.inner_curve}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </td>
                                    ))}
                                </tr>
                                {/* Tight Fit Row */}
                                <tr>
                                  <td className="px-2 py-3 whitespace-nowrap text-sm font-medium text-yellow-700 group relative text-center">
                                    Tight
                                    <svg
                                      className="inline-block ml-1 h-4 w-4 text-yellow-700 cursor-help"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 w-72 p-3 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-normal text-center shadow-lg">
                                      Snug fit for a more secure hold
                                    </div>
                                  </td>
                                  {measurements
                                    .slice(5)
                                    .map((measurement, index) => (
                                      <td
                                        key={index}
                                        className={`px-2 py-3 whitespace-nowrap text-sm text-center ${
                                          !measurement.nail_bed_curve
                                            ? "opacity-50"
                                            : ""
                                        }`}
                                      >
                                        {matchedSizes[
                                          measurement.finger_position
                                        ]?.width?.map((size) => (
                                          <div
                                            key={`tight-${size.id}`}
                                            className={`text-yellow-700 ${
                                              !measurement.nail_bed_curve
                                                ? "cursor-not-allowed"
                                                : ""
                                            }`}
                                          >
                                            <span className="font-bold">
                                              {size.size_label}
                                            </span>
                                            <div className="text-xs text-yellow-600">
                                              W: {size.width}
                                            </div>
                                            {size.inner_curve && (
                                              <div className="text-xs text-yellow-600">
                                                C: {size.inner_curve}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </td>
                                    ))}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveStep(2)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={isUpdating ? handleUpdateClick : handleSaveClick}
                      disabled={
                        !clientInfo.name.trim() ||
                        loading ||
                        saveStatus === "saving" ||
                        (isUpdating && !hasMeasurementsChanged()) ||
                        (!isUpdating && !hasAnyMeasurements())
                      }
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {saveStatus === "saving"
                        ? "Saving..."
                        : isUpdating
                        ? "Update Measurements"
                        : "Save Measurements"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <SelectClientModal
        isOpen={isSelectClientModalOpen}
        onClose={() => setIsSelectClientModalOpen(false)}
        onSelectClient={handleClientSelect}
      />
    </div>
  );
}
