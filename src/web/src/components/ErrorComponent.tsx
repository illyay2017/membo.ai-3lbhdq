const ErrorComponent: React.FC = () => (
  <div className="flex items-center justify-center h-screen p-4">
    <div className="text-center">
      <h2 className="text-lg font-semibold text-error mb-2">
        Something went wrong
      </h2>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-primary text-white rounded-md"
      >
        Refresh Page
      </button>
    </div>
  </div>
);

export default ErrorComponent;
