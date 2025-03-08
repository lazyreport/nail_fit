import { useState, useEffect } from "react";
import { Disclosure, Transition } from "@headlessui/react";
import { ChevronUpIcon } from "@heroicons/react/20/solid";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Brand, NailTipSet, NailTipSize } from "../types/database";
import { fetchData } from "../lib/database";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

interface NailTipSetWithDetails extends NailTipSet {
  brand: Brand;
  sizes: NailTipSize[];
}

export function NailTipSetList() {
  const navigate = useNavigate();
  const [nailTipSets, setNailTipSets] = useState<NailTipSetWithDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadNailTipSets();
    checkCredits();
  }, []);

  async function checkCredits() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: creditsData } = await supabase
      .from("User Credits")
      .select("credits, is_admin")
      .eq("user_id", user.id)
      .single();

    if (creditsData) {
      setCredits(creditsData.credits);
      setIsAdmin(creditsData.is_admin);
    }
  }

  const handleNewSet = async () => {
    if (!isAdmin && (!credits || credits < 1)) {
      alert("You need at least 1 credit to create a new nail set.");
      return;
    }

    if (!isAdmin) {
      // Deduct 1 credit
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("User Credits")
        .update({ credits: credits! - 1 })
        .eq("user_id", user.id);

      if (error) {
        alert("Failed to deduct credit. Please try again.");
        return;
      }

      // Update local credits state
      setCredits(credits! - 1);
    }

    // Navigate to the form
    navigate("/nail-tip-sets/new");
  };

  async function loadNailTipSets() {
    try {
      // Fetch nail tip sets
      const sets = await fetchData<NailTipSet>("Nail Tip Sets");

      // Fetch all brands
      const brands = await fetchData<Brand>("Brand");

      // Combine the data
      const setsWithDetails = await Promise.all(
        sets.map(async (set) => {
          // Fetch sizes for this specific set only
          const setSpecificSizes = await fetchData<NailTipSize>(
            "Nail Tip Sizes",
            `tip_set_id = ${set.id}`
          );
          return {
            ...set,
            brand: brands.find((b) => b.id === set.brand_id)!,
            sizes: setSpecificSizes.sort((a, b) => b.width - a.width),
          };
        })
      );

      setNailTipSets(setsWithDetails);
    } catch (error) {
      setError("Failed to load nail tip sets");
      console.error("Error loading nail tip sets:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredSets = nailTipSets.filter((set) => {
    if (!searchQuery) return true;
    const searchTerms = searchQuery.toLowerCase().split(" ");
    const searchableText = [
      set.name,
      set.brand.name,
      set.shape,
      set.length?.toString(),
      ...set.sizes.map((s) => s.size_label),
    ]
      .map((text) => text?.toLowerCase() ?? "")
      .join(" ");

    return searchTerms.every((term) => searchableText.includes(term));
  });

  const handleEdit = (set: NailTipSetWithDetails) => {
    navigate(`/nail-tip-sets/edit/${set.id}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="text-gray-500">Loading nail tip sets...</div>
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 text-red-600 p-3 rounded-md">{error}</div>;
  }

  if (nailTipSets.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">
          No nail tip sets found
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          Get started by adding your first nail tip set.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon
              className="h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
          </div>
          <input
            type="text"
            className="block w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Search nail tip sets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={handleNewSet}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          New Set {!isAdmin && `(${credits ?? 0} credits)`}
        </button>
      </div>

      {filteredSets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">
            No nail tip sets found matching "{searchQuery}"
          </p>
        </div>
      ) : (
        filteredSets.map((set) => (
          <Disclosure key={set.id}>
            {({ open }) => (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <Disclosure.Button className="w-full focus:outline-none  hover:bg-gray-100 transition-colors duration-200">
                  <div className={`px-4 py-5 sm:px-6  `}>
                    <div className="flex justify-between items-start gap-8">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-medium text-gray-900 text-left">
                          {[
                            set.brand.name.toUpperCase(),
                            set.name,
                            set.shape,
                            set.length,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        </h3>
                      </div>
                      <div className="flex items-start gap-4">
                        <ChevronUpIcon
                          className={`${
                            open ? "transform rotate-180" : ""
                          } w-5 h-5 text-gray-500 transition-transform duration-200`}
                        />
                      </div>
                    </div>
                  </div>
                </Disclosure.Button>

                <Transition
                  enter="transition-all duration-300 ease-out"
                  enterFrom="max-h-0 opacity-0"
                  enterTo="max-h-[1000px] opacity-100"
                  leave="transition-all duration-300 ease-out"
                  leaveFrom="max-h-[1000px] opacity-100"
                  leaveTo="max-h-0 opacity-0"
                >
                  <Disclosure.Panel static>
                    <div className="px-4 py-5 sm:px-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <h4 className="text-sm font-medium text-gray-900">
                            Sizes ({set.sizes.length})
                          </h4>
                          <button
                            onClick={() => handleEdit(set)}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                          >
                            Edit Set
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                        {set.sizes.map((size) => (
                          <div
                            key={size.id}
                            className="border border-gray-200 rounded-md p-4"
                          >
                            <div className="font-medium text-gray-900">
                              {size.size_label}
                            </div>
                            <dl className="mt-2 text-sm">
                              <div className="flex justify-between">
                                <dt className="text-gray-500">Length:</dt>
                                <dd className="text-gray-900">
                                  {size.length} mm
                                </dd>
                              </div>
                              <div className="flex justify-between mt-1">
                                <dt className="text-gray-500">Width:</dt>
                                <dd className="text-gray-900">
                                  {size.width} mm
                                </dd>
                              </div>
                              {size.inner_curve && (
                                <div className="flex justify-between mt-1">
                                  <dt className="text-gray-500">
                                    Inner Curve:
                                  </dt>
                                  <dd className="text-gray-900">
                                    {size.inner_curve} mm
                                  </dd>
                                </div>
                              )}
                            </dl>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Disclosure.Panel>
                </Transition>
              </div>
            )}
          </Disclosure>
        ))
      )}
    </div>
  );
}
