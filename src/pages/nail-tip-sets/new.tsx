import { NailTipSetForm } from "../../components/NailTipSetForm";

export default function NewNailTipSet() {
  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 sm:px-0">
        <h1 className="text-2xl font-semibold text-gray-900">
          Add New Nail Tip Set
        </h1>
      </div>
      <div className="mt-5">
        <NailTipSetForm />
      </div>
    </div>
  );
}
