export default function LoadingScreen({ visible }) {
  return (
    <div className={`loading-screen ${visible ? '' : 'loading-screen--hidden'}`} aria-hidden={!visible}>
      <div className="loading-mark">
        <span className="loading-mark-text">PG</span>
        <div className="loading-ring" />
        <div className="loading-ring loading-ring--2" />
      </div>
    </div>
  );
}
