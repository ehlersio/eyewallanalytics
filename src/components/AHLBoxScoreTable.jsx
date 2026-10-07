// components/AHLBoxScoreTable.jsx
// AHL box score table: the shared HockeyTechBoxScoreTable with the AHL
// league object (utils/hockeyTechLeagues.js).
import HockeyTechBoxScoreTable from './hockeytech/HockeyTechBoxScoreTable';
import { AHL } from '../utils/hockeyTechLeagues';

export default function AHLBoxScoreTable(props) {
  return <HockeyTechBoxScoreTable league={AHL} {...props} />;
}
