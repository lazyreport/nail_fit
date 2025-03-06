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
        undefined,
        {
          eq: { column: "client_id", value: selectedClientId },
          order: { column: "date_measured", ascending: false },
        }
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

      // Delete existing measurements
      const { error: deleteError } = await supabase
        .from("Measurements")
        .delete()
        .eq("client_id", selectedClientId);

      if (deleteError) {
        throw new Error("Failed to delete old measurements");
      }

      // Save new measurements
      const validMeasurements = measurements
        .filter((measurement) => measurement.nail_bed_width > 0)
        .map((measurement) => ({
          finger_position: measurement.finger_position,
          nail_bed_width: Number(measurement.nail_bed_width) || 0,
          nail_bed_curve: measurement.nail_bed_curve
            ? Number(measurement.nail_bed_curve)
            : null,
          date_measured: new Date().toISOString(),
          client_id: selectedClientId,
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
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (error) {
      console.error("Error updating:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

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

          // Sort by combined score
          sizesWithScores.sort((a, b) => a.score - b.score);

          // Find comfort fit (slightly larger width)
          const comfortFit = sizesWithScores.find(
            (size) => size.width >= targetWidth
          );

          // Find tight fit (slightly smaller width)
          const tightFit = sizesWithScores.find(
            (size) => size.width <= targetWidth
          );

          // Perfect fit is the size with the best overall score
          const perfectFit = sizesWithScores[0];

          matchResult.width = tightFit ? [tightFit] : undefined;
          matchResult.curve = comfortFit ? [comfortFit] : undefined;

          // Store the matches
          matches[measurement.finger_position] = {
            ...matchResult,
            width: tightFit ? [tightFit] : undefined,
            curve: comfortFit ? [comfortFit] : undefined,
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
        undefined,
        {
          eq: { column: "client_id", value: selectedClientId },
          order: { column: "date_measured", ascending: false },
        }
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
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .shake {
          animation: shake 0.8s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
      <div className="w-full flex-1 space-y-6">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-medium text-gray-900">
                Find Matching Sizes
              </h2>
            </div>
          </div>

          <div className="space-y-4">
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
                {loading ? "Finding matches..." : "Size"}
              </button>
            </div>

            {/* Size Table */}
            {selectedSet && (
              <div className="mt-4 bg-white rounded-lg shadow overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    Available Sizes - {selectedSet.displayName}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Size Label
                        </th>
                        {allSizes.map((size) => (
                          <th
                            key={size.id}
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {size.size_label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          Width (mm)
                        </td>
                        {allSizes.map((size) => (
                          <td
                            key={size.id}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            {size.width}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          Length (mm)
                        </td>
                        {allSizes.map((size) => (
                          <td
                            key={size.id}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            {size.length}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          IC
                        </td>
                        {allSizes.map((size) => (
                          <td
                            key={size.id}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
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

            {/* Width Matching Strategy Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="prefer-smaller-sizes"
                checked={preferSmallerSizes}
                onChange={(e) => setPreferSmallerSizes(e.target.checked)}
                className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300 rounded"
              />
              <label
                htmlFor="prefer-smaller-sizes"
                className="ml-2 block text-sm text-gray-700"
              >
                Prefer smaller sizes (when unchecked, finds closest match)
              </label>
            </div>

            {/* Tapered Shape Compensation Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="tapered-compensation"
                checked={useTaperedCompensation}
                onChange={(e) => setUseTaperedCompensation(e.target.checked)}
                className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300 rounded"
              />
              <label
                htmlFor="tapered-compensation"
                className="ml-2 block text-sm text-gray-700"
              >
                Add 0.5mm for tapered shapes (almond/stiletto)
              </label>
            </div>

            {selectedSet &&
              (selectedSet.shape.toLowerCase().includes("almond") ||
                selectedSet.shape.toLowerCase().includes("stilleto")) && (
                <div className="mt-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-700">
                    Note: For {selectedSet.shape} shapes, we recommend sizing up
                    slightly to ensure a comfortable fit at the nail bed. The
                    suggested sizes below have been automatically adjusted.
                  </p>
                </div>
              )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:space-x-8 space-y-8 lg:space-y-0 p-6">
          {/* Left Hand */}
          <div className="w-full lg:w-1/2">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Left
            </h3>
            {/* Single hand image for left hand */}
            <div className="w-full max-w-[400px] mx-auto aspect-w-4 aspect-h-3">
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={leftHandImage}
                  alt="Left Hand"
                  className="object-contain w-full h-full max-h-[300px]"
                  onError={(e) => {
                    console.log("Image load error details:", {
                      src: e.currentTarget.src,
                      path: window.location.pathname,
                      absolutePath: new URL(
                        e.currentTarget.src,
                        window.location.href
                      ).href,
                      importPath: leftHandImage,
                    });
                    const target = e.target as HTMLImageElement;
                    const parent = target.parentElement;
                    if (parent) {
                      target.style.display = "none";
                      const placeholder = document.createElement("span");
                      placeholder.textContent = "Left Hand Image";
                      parent.appendChild(placeholder);
                    }
                  }}
                />
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {/* Width inputs */}
              <div className="flex flex-row justify-start gap-1 sm:gap-2">
                {measurements
                  .slice(0, 5)
                  .reverse()
                  .map((measurement, index) => (
                    <div
                      key={`width-${index}`}
                      className="w-[20%] flex flex-col items-center"
                    >
                      <label className="block text-sm sm:text-base font-semibold text-gray-900 mb-1">
                        {measurement.finger_position.replace("Left ", "")}
                      </label>
                      <label className="block text-[9px] sm:text-[10px] font-medium text-gray-500">
                        Width
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={measurement.nail_bed_width || ""}
                        onChange={(e) =>
                          handleMeasurementChange(
                            4 - index,
                            "nail_bed_width",
                            e.target.value
                          )
                        }
                        className="mt-1 block w-10 sm:w-14 rounded-md border border-gray-300 bg-white py-1 sm:py-2 px-1 sm:px-3 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 text-gray-900 text-xs sm:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />

                      {/* Size Matches for Left Hand */}
                      {Object.keys(matchedSizes).length > 0 &&
                        measurement.nail_bed_width > 0 && (
                          <div className="mt-4 w-full space-y-2">
                            {(() => {
                              const matches =
                                matchedSizes[measurement.finger_position];
                              if (!matches) return null;

                              const comfortFit = matches.width?.[0];
                              const tightFit = matches.curve?.[0];
                              let perfectFit = comfortFit;

                              if (
                                comfortFit &&
                                tightFit &&
                                matches.availableSizes
                              ) {
                                const comfortSize = parseFloat(
                                  comfortFit.size_label
                                );
                                const tightSize = parseFloat(
                                  tightFit.size_label
                                );
                                if (comfortSize === tightSize) {
                                  perfectFit = comfortFit;
                                } else {
                                  const perfectSize =
                                    (comfortSize + tightSize) / 2;
                                  perfectFit =
                                    matches.availableSizes.find(
                                      (s) =>
                                        parseFloat(s.size_label) === perfectSize
                                    ) || comfortFit;
                                }
                              }

                              return (
                                <>
                                  {comfortFit && (
                                    <div
                                      className="bg-blue-50 rounded p-1 text-center group relative"
                                      title={`Width: ${
                                        comfortFit.width
                                      }mm\nCurve: ${
                                        comfortFit.inner_curve || "N/A"
                                      }mm`}
                                    >
                                      <div className="text-[10px] font-medium text-blue-900">
                                        Comfort: {comfortFit.size_label}
                                      </div>
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs rounded-md absolute z-10 px-2 py-1 -top-12 left-1/2 transform -translate-x-1/2 w-max">
                                        Width: {comfortFit.width}mm
                                        <br />
                                        Curve: {comfortFit.inner_curve || "N/A"}
                                        mm
                                      </div>
                                    </div>
                                  )}
                                  {perfectFit && (
                                    <div
                                      className="bg-green-50 rounded p-1 text-center ring-1 ring-green-500 group relative"
                                      title={`Width: ${
                                        perfectFit.width
                                      }mm\nCurve: ${
                                        perfectFit.inner_curve || "N/A"
                                      }mm`}
                                    >
                                      <div className="text-[10px] font-medium text-green-900">
                                        Perfect: {perfectFit.size_label}
                                      </div>
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs rounded-md absolute z-10 px-2 py-1 -top-12 left-1/2 transform -translate-x-1/2 w-max">
                                        Width: {perfectFit.width}mm
                                        <br />
                                        Curve: {perfectFit.inner_curve || "N/A"}
                                        mm
                                      </div>
                                    </div>
                                  )}
                                  {tightFit && (
                                    <div
                                      className="bg-purple-50 rounded p-1 text-center group relative"
                                      title={`Width: ${
                                        tightFit.width
                                      }mm\nCurve: ${
                                        tightFit.inner_curve || "N/A"
                                      }mm`}
                                    >
                                      <div className="text-[10px] font-medium text-purple-900">
                                        Tight: {tightFit.size_label}
                                      </div>
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs rounded-md absolute z-10 px-2 py-1 -top-12 left-1/2 transform -translate-x-1/2 w-max">
                                        Width: {tightFit.width}mm
                                        <br />
                                        Curve: {tightFit.inner_curve || "N/A"}mm
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                    </div>
                  ))}
              </div>
              {/* Curvature inputs */}
              <div className="flex flex-row justify-start gap-1 sm:gap-2">
                {measurements
                  .slice(0, 5)
                  .reverse()
                  .map((measurement, index) => (
                    <div
                      key={`curve-${index}`}
                      className="w-[20%] flex flex-col items-center"
                    >
                      <label className="block text-[9px] sm:text-[10px] font-medium text-gray-500">
                        Curvature
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={measurement.nail_bed_curve || ""}
                        onChange={(e) =>
                          handleMeasurementChange(
                            4 - index,
                            "nail_bed_curve",
                            e.target.value
                          )
                        }
                        className="mt-1 block w-10 sm:w-14 rounded-md border border-gray-300 bg-white py-1 sm:py-2 px-1 sm:px-3 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 text-gray-900 text-xs sm:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Right Hand */}
          <div className="w-full lg:w-1/2">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Right
            </h3>
            {/* Single hand image for right hand */}
            <div className="w-full max-w-[400px] mx-auto aspect-w-4 aspect-h-3">
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={rightHandImage}
                  alt="Right Hand"
                  className="object-contain w-full h-full max-h-[300px]"
                  onError={(e) => {
                    console.log("Image load error details:", {
                      src: e.currentTarget.src,
                      path: window.location.pathname,
                      absolutePath: new URL(
                        e.currentTarget.src,
                        window.location.href
                      ).href,
                      importPath: rightHandImage,
                    });
                    const target = e.target as HTMLImageElement;
                    const parent = target.parentElement;
                    if (parent) {
                      target.style.display = "none";
                      const placeholder = document.createElement("span");
                      placeholder.textContent = "Right Hand Image";
                      parent.appendChild(placeholder);
                    }
                  }}
                />
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {/* Width inputs */}
              <div className="flex flex-row justify-start gap-1 sm:gap-2">
                {measurements.slice(5).map((measurement, index) => (
                  <div
                    key={`width-${index + 5}`}
                    className="w-[20%] flex flex-col items-center"
                  >
                    <label className="block text-sm sm:text-base font-semibold text-gray-900 mb-1">
                      {measurement.finger_position.replace("Right ", "")}
                    </label>
                    <label className="block text-[9px] sm:text-[10px] font-medium text-gray-500">
                      Width
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
                      className="mt-1 block w-10 sm:w-14 rounded-md border border-gray-300 bg-white py-1 sm:py-2 px-1 sm:px-3 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 text-gray-900 text-xs sm:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />

                    {/* Size Matches for Right Hand */}
                    {Object.keys(matchedSizes).length > 0 &&
                      measurement.nail_bed_width > 0 && (
                        <div className="mt-4 w-full space-y-2">
                          {(() => {
                            const matches =
                              matchedSizes[measurement.finger_position];
                            if (!matches) return null;

                            const comfortFit = matches.width?.[0];
                            const tightFit = matches.curve?.[0];
                            let perfectFit = comfortFit;

                            if (
                              comfortFit &&
                              tightFit &&
                              matches.availableSizes
                            ) {
                              const comfortSize = parseFloat(
                                comfortFit.size_label
                              );
                              const tightSize = parseFloat(tightFit.size_label);
                              if (comfortSize === tightSize) {
                                perfectFit = comfortFit;
                              } else {
                                const perfectSize =
                                  (comfortSize + tightSize) / 2;
                                perfectFit =
                                  matches.availableSizes.find(
                                    (s) =>
                                      parseFloat(s.size_label) === perfectSize
                                  ) || comfortFit;
                              }
                            }

                            return (
                              <>
                                {comfortFit && (
                                  <div
                                    className="bg-blue-50 rounded p-1 text-center group relative"
                                    title={`Width: ${
                                      comfortFit.width
                                    }mm\nCurve: ${
                                      comfortFit.inner_curve || "N/A"
                                    }mm`}
                                  >
                                    <div className="text-[10px] font-medium text-blue-900">
                                      Comfort: {comfortFit.size_label}
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs rounded-md absolute z-10 px-2 py-1 -top-12 left-1/2 transform -translate-x-1/2 w-max">
                                      Width: {comfortFit.width}mm
                                      <br />
                                      Curve: {comfortFit.inner_curve || "N/A"}mm
                                    </div>
                                  </div>
                                )}
                                {perfectFit && (
                                  <div
                                    className="bg-green-50 rounded p-1 text-center ring-1 ring-green-500 group relative"
                                    title={`Width: ${
                                      perfectFit.width
                                    }mm\nCurve: ${
                                      perfectFit.inner_curve || "N/A"
                                    }mm`}
                                  >
                                    <div className="text-[10px] font-medium text-green-900">
                                      Perfect: {perfectFit.size_label}
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs rounded-md absolute z-10 px-2 py-1 -top-12 left-1/2 transform -translate-x-1/2 w-max">
                                      Width: {perfectFit.width}mm
                                      <br />
                                      Curve: {perfectFit.inner_curve || "N/A"}mm
                                    </div>
                                  </div>
                                )}
                                {tightFit && (
                                  <div
                                    className="bg-purple-50 rounded p-1 text-center group relative"
                                    title={`Width: ${
                                      tightFit.width
                                    }mm\nCurve: ${
                                      tightFit.inner_curve || "N/A"
                                    }mm`}
                                  >
                                    <div className="text-[10px] font-medium text-purple-900">
                                      Tight: {tightFit.size_label}
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs rounded-md absolute z-10 px-2 py-1 -top-12 left-1/2 transform -translate-x-1/2 w-max">
                                      Width: {tightFit.width}mm
                                      <br />
                                      Curve: {tightFit.inner_curve || "N/A"}mm
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                  </div>
                ))}
              </div>
              {/* Curvature inputs */}
              <div className="flex flex-row justify-start gap-1 sm:gap-2">
                {measurements.slice(5).map((measurement, index) => (
                  <div
                    key={`curve-${index + 5}`}
                    className="w-[20%] flex flex-col items-center"
                  >
                    <label className="block text-[9px] sm:text-[10px] font-medium text-gray-500">
                      Curvature
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
                      className="mt-1 block w-10 sm:w-14 rounded-md border border-gray-300 bg-white py-1 sm:py-2 px-1 sm:px-3 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 text-gray-900 text-xs sm:text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Help Text */}
        {Object.keys(matchedSizes).length > 0 && (
          <div className="mt-6 px-6">
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
              <p className="font-medium mb-2">Size Match Guide:</p>
              <ul className="space-y-1 list-disc pl-5">
                <li>
                  <span className="text-blue-700 font-medium">
                    Comfort Fit:
                  </span>{" "}
                  Prioritizes less pressure on natural nail
                </li>
                <li>
                  <span className="text-green-700 font-medium">
                    Perfect Fit:
                  </span>{" "}
                  Balances between comfort and adhesion
                </li>
                <li>
                  <span className="text-purple-700 font-medium">
                    Tight Fit:
                  </span>{" "}
                  Prioritizes better adhesion
                </li>
              </ul>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-700 px-6 mt-4">
          *All measurements are in millimeters
        </p>

        {/* Client Name Input */}
        <div className="px-6">
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
            <p className="mt-1 text-sm text-red-500">Client name is required</p>
          )}
        </div>

        {/* Notes Input */}
        <div className="px-6">
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

        <div className="flex justify-between px-6 w-full items-center gap-4">
          {/* Select Client Button */}
          <button
            type="button"
            onClick={() => setIsSelectClientModalOpen(true)}
            className=" inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Select Client
          </button>
          {/* Save Status and Button */}
          {saveStatus === "saved" && (
            <span className="text-green-600 text-sm">
              Measurements saved successfully!
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-red-600 text-sm">
              Error saving measurements
            </span>
          )}
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
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
              !clientInfo.name.trim() ||
              loading ||
              saveStatus === "saving" ||
              (isUpdating && !hasMeasurementsChanged()) ||
              (!isUpdating && !hasAnyMeasurements())
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gray-600 hover:bg-gray-700"
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500`}
          >
            {saveStatus === "saving"
              ? "Saving..."
              : isUpdating
              ? "Update Measurements"
              : "Save Measurements"}
          </button>
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
