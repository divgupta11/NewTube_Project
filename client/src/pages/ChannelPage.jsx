import { useParams } from "react-router-dom";
import Profile from "./Profile";

const ChannelPage = ({ user, onOpenLogin, onUserUpdated }) => {
  const { channelId } = useParams();

  return (
    <Profile
      user={user}
      onOpenLogin={onOpenLogin}
      onUserUpdated={onUserUpdated}
      profileUserId={channelId}
    />
  );
};

export default ChannelPage;
